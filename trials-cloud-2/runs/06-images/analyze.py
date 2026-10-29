# Reads scored.json -> analysis.json + a text table. Knee = smallest bytes with ssim_rgb >= 0.97 (per image, per encoder).
import json, statistics as st, collections
rows = json.load(open('scored.json'))
TH = 0.97
imgs = sorted({r['image'] for r in rows}); encs = [e for e in dict.fromkeys(r['encoder'] for r in rows) if e not in ('png-source',)]
png = {r['image']: r['bytes'] for r in rows if r['encoder'] == 'png-source'}
base = {r['image']: r for r in rows if r['encoder'] == 'jpeg-sharp'}
istext = lambda n: n.startswith('banner_') or n.startswith('flat_')
# baseline mix: JPEG-80 for photos+banners, PNG as-is for the flat render
base_mix = {i: (png[i] if i.startswith('flat_') else base[i]['bytes']) for i in imgs}
out = {'threshold_ssim_rgb': TH, 'images': imgs, 'png_source_bytes': png,
       'baseline_jpeg80': {i: {'bytes': base[i]['bytes'], 'ssim_rgb': base[i]['ssim_rgb'], 'ssim_gray': base[i]['ssim_gray'], 'dssim': base[i].get('dssim'), 'ms': base[i]['ms']} for i in imgs},
       'baseline_jpeg80_total_bytes': sum(base[i]['bytes'] for i in imgs), 'baseline_mix_total_bytes': sum(base_mix.values()),
       'baseline_jpeg80_images_below_threshold': [i for i in imgs if base[i]['ssim_rgb'] < TH], 'encoders': {}}
lines = []
for e in encs:
    if e == 'jpeg-sharp': continue
    er = [r for r in rows if r['encoder'] == e]
    knees, miss, total, qs, ms_all, knee_dssim = {}, [], 0, [], [], []
    for i in imgs:
        cand = [r for r in er if r['image'] == i and r['ssim_rgb'] >= TH]
        allq = [r for r in er if r['image'] == i]
        ms_all.append(sum(r['ms'] for r in allq) / len(allq))
        if not cand:
            miss.append({'image': i, 'best_ssim_rgb_at_q90': max(r['ssim_rgb'] for r in allq), 'bytes_at_q90': [r['bytes'] for r in allq if r['q'] == 90][0]}); continue
        k = min(cand, key=lambda r: r['bytes']); knees[i] = {'q': k['q'], 'bytes': k['bytes'], 'ssim_rgb': k['ssim_rgb'], 'ssim_gray': k['ssim_gray'], 'dssim': k.get('dssim'), 'vs_jpeg80_pct': round(100 * k['bytes'] / base[i]['bytes'], 1), 'vs_baseline_mix_pct': round(100 * k['bytes'] / base_mix[i], 1)}
        total += k['bytes']; qs.append(k['q'])
        if k.get('dssim') is not None: knee_dssim.append(k['dssim'])
    reached = list(knees)
    bt = sum(base[i]['bytes'] for i in reached); bm = sum(base_mix[i] for i in reached)
    q80 = {i: [r for r in er if r['image'] == i and r['q'] == 80][0] for i in imgs}
    out['encoders'][e] = {'knee': knees, 'cannot_reach_threshold': miss, 'images_reached': len(reached), 'total_bytes_at_knee': total,
        'baseline_jpeg80_bytes_same_images': bt, 'knee_pct_of_jpeg80': round(100 * total / bt, 1) if bt else None,
        'baseline_mix_bytes_same_images': bm, 'knee_pct_of_baseline_mix': round(100 * total / bm, 1) if bm else None,
        'mean_q_at_knee': round(st.mean(qs), 1) if qs else None, 'median_dssim_at_knee': round(st.median(knee_dssim), 4) if knee_dssim else None,
        'mean_encode_ms_per_image': round(st.mean(ms_all), 1), 'total_bytes_at_q80': sum(r['bytes'] for r in q80.values()), 'mean_ssim_rgb_at_q80': round(st.mean(r['ssim_rgb'] for r in q80.values()), 4),
        'text_images_below_threshold_at_q90': [m['image'] for m in miss if istext(m['image'])]}
    lines.append(f"{e:20s} reached {len(reached)}/8  knee total {total:8d} B = {out['encoders'][e]['knee_pct_of_jpeg80']}% of JPEG-80 ({bt} B) / {out['encoders'][e]['knee_pct_of_baseline_mix']}% of mix  mean q {out['encoders'][e]['mean_q_at_knee']}  ms/img {out['encoders'][e]['mean_encode_ms_per_image']}  q80 total {out['encoders'][e]['total_bytes_at_q80']} ssim {out['encoders'][e]['mean_ssim_rgb_at_q80']}  miss: {[m['image'] for m in miss]}")
json.dump(out, open('analysis.json', 'w'), indent=1)
print(f"baseline JPEG-80 total {out['baseline_jpeg80_total_bytes']} B; mix total {out['baseline_mix_total_bytes']} B; JPEG-80 below {TH}: {out['baseline_jpeg80_images_below_threshold']}")
for i in imgs: print(f"  {i:24s} png {png[i]:7d}  jpeg80 {base[i]['bytes']:7d} ssim {base[i]['ssim_rgb']:.4f} dssim {base[i].get('dssim')}")
print('\n'.join(lines))
print('\nper-image knee (bytes@q):')
for i in imgs:
    print(f"  {i:24s} " + '  '.join(f"{e.replace('squoosh','sq').replace('sharp','sh').replace('tuned','t'):14s}{(str(out['encoders'][e]['knee'][i]['bytes'])+'@'+str(out['encoders'][e]['knee'][i]['q'])) if i in out['encoders'][e]['knee'] else 'MISS':>10s}" for e in out['encoders']))

# ---- second knee: "match today's quality": smallest bytes with ssim_rgb >= JPEG-80's ssim_rgb on the same image (and dssim <= JPEG-80's dssim)
print('\nmatch-baseline knee (ssim_rgb >= jpeg80 ssim_rgb of same image); flat image uses jpeg80 too but its mix baseline is the PNG')
for e in out['encoders']:
    er = [r for r in rows if r['encoder'] == e]; tot = 0; qs = []; totd = 0; qsd = []; per = {}
    for i in imgs:
        c = [r for r in er if r['image'] == i and r['ssim_rgb'] >= base[i]['ssim_rgb']]
        k = min(c, key=lambda r: r['bytes']); tot += k['bytes']; qs.append(k['q'])
        cd = [r for r in er if r['image'] == i and r['dssim'] is not None and r['dssim'] <= base[i]['dssim']]
        kd = min(cd, key=lambda r: r['bytes']) if cd else None
        if kd: totd += kd['bytes']; qsd.append(kd['q'])
        per[i] = {'q': k['q'], 'bytes': k['bytes'], 'ssim_rgb': k['ssim_rgb'], 'pct_of_jpeg80': round(100 * k['bytes'] / base[i]['bytes'], 1), 'dssim_knee_q': kd['q'] if kd else None, 'dssim_knee_bytes': kd['bytes'] if kd else None}
    out['encoders'][e]['knee_match_jpeg80'] = {'per_image': per, 'total_bytes': tot, 'pct_of_jpeg80_total': round(100 * tot / out['baseline_jpeg80_total_bytes'], 1), 'mean_q': round(st.mean(qs), 1),
        'dssim_total_bytes': totd, 'dssim_pct_of_jpeg80_total': round(100 * totd / out['baseline_jpeg80_total_bytes'], 1), 'dssim_mean_q': round(st.mean(qsd), 1) if qsd else None, 'dssim_images_matched': len(qsd)}
    print(f"{e:20s} SSIM-matched total {tot:7d} B = {out['encoders'][e]['knee_match_jpeg80']['pct_of_jpeg80_total']:5.1f}% of JPEG-80, mean q {st.mean(qs):4.1f} | DSSIM-matched {len(qsd)}/8 total {totd:7d} B = {out['encoders'][e]['knee_match_jpeg80']['dssim_pct_of_jpeg80_total']:5.1f}%, mean q {out['encoders'][e]['knee_match_jpeg80']['dssim_mean_q']}  per-image q: {[per[i]['q'] for i in imgs]}")
json.dump(out, open('analysis.json', 'w'), indent=1)
