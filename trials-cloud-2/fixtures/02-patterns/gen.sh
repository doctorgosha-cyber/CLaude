#!/usr/bin/env bash
# Generator for 02-patterns fixtures: 8 seeded files (S1..S8) + 4 clean controls (C1..C4).
# Re-run to regenerate. Layout mimics a WordPress theme + static figure-page scripts.
set -e
D="$(cd "$(dirname "$0")" && pwd)/theme"
rm -rf "$D"; mkdir -p "$D/assets/js" "$D/inc" "$D/template-parts"

# ---------- S1: aliased / computed eval (js) ----------
cat > "$D/assets/js/lazy-eval.js" <<'EOF'
// Legacy config loader kept for old figure pages (nexus-figures v1).
export function loadConfig(str) {
  const e = eval;                 // S1a: eval aliased to a local
  const cfg = e(str);
  return cfg && typeof cfg === 'object' ? cfg : {};
}

export function runHook(code) {
  // S1b: eval reached through a computed member on window
  return window['ev' + 'al'](code);
}

export function pick(list, i) {
  return list[i % list.length];
}
EOF

# ---------- S2: template-literal innerHTML (js) ----------
cat > "$D/assets/js/figure-render.js" <<'EOF'
// Renders the "rated by" badge on figure pages.
export function renderBadge(el, user, score) {
  const stars = '*'.repeat(Math.max(0, Math.min(5, score | 0)));
  el.innerHTML = `<b>${user}</b> rated ${stars}`;   // S2: user data in a template literal
  el.classList.add('badge--ready');
}

export function clearBadge(el) {
  el.textContent = '';
}
EOF

# ---------- S3: echo of a $_GET value assigned two statements earlier (php) ----------
cat > "$D/search.php" <<'EOF'
<?php
/**
 * Template Name: Review search
 * @package nexus
 */
get_header();

$q        = $_GET['q'];                 // S3: raw request value
$per_page = 10;
$results  = nexus_search_reviews( $q, $per_page );

echo '<h1>' . esc_html__( 'Results for', 'nexus' ) . '</h1>';
echo $q;                                // S3: echoed unescaped two statements later

foreach ( $results as $r ) {
	echo '<p>' . esc_html( $r->title ) . '</p>';
}
get_footer();
EOF

# ---------- S4: interpolated SQL into $wpdb (php) ----------
cat > "$D/inc/cleanup.php" <<'EOF'
<?php
/**
 * Review maintenance helpers.
 * @package nexus
 */

function nexus_delete_review( $id ) {
	global $wpdb;
	$t = $wpdb->prefix . 'nexus_reviews';
	$wpdb->query( "DELETE FROM $t WHERE id = $id" );                                   // S4a
}

function nexus_get_by_slug( $slug ) {
	global $wpdb;
	return $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}nexus_reviews WHERE slug = '$slug'" ); // S4b
}

function nexus_count_reviews() {
	global $wpdb;
	return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}nexus_reviews" );
}
EOF

# ---------- S5: new Function(body) (js) ----------
cat > "$D/assets/js/calc-formula.js" <<'EOF'
// Pet-food calculator: evaluates a per-product formula from the JSON catalogue.
export function compileFormula(body) {
  const fn = new Function('weight', 'age', body);   // S5: dynamic code from catalogue data
  return (weight, age) => Number(fn(weight, age)) || 0;
}

export function kcalPerDay(weight) {
  return 70 * Math.pow(weight, 0.75);
}
EOF

# ---------- S6: document.write(x) (js) ----------
cat > "$D/assets/js/legacy-widget.js" <<'EOF'
// Old partner widget embed (pre-2020). Still loaded on a few figure pages.
(function () {
  var x = window.NEXUS_WIDGET_HTML || '';
  if (x) {
    document.write(x);          // S6
  }
  var host = document.getElementById('partner-widget');
  if (host) host.setAttribute('data-ready', '1');
})();
EOF

# ---------- S7: setTimeout with a string argument (js) ----------
cat > "$D/assets/js/timers.js" <<'EOF'
// Deferred init for the explainer-film player.
function doIt() {
  document.body.classList.add('player-ready');
}
window.addEventListener('load', function () {
  setTimeout("doIt()", 100);   // S7: string argument is implicit eval
});
EOF

# ---------- S8: unescaped attribute echo (php) ----------
cat > "$D/template-parts/figure-link.php" <<'EOF'
<?php
/**
 * Figure link card.
 * @package nexus
 */
$url   = get_post_meta( get_the_ID(), 'nexus_figure_url', true );
$title = get_the_title();
?>
<div class="figure-card">
	<a href="<?php echo $url; ?>" class="figure-link"><?php echo esc_html( $title ); ?></a>   <!-- S8 -->
	<span class="figure-card__meta"><?php echo esc_html( get_the_date() ); ?></span>
</div>
EOF

# ---------- C1: escaped echo of $_GET-derived value + esc_url attribute (php, control) ----------
cat > "$D/search-safe.php" <<'EOF'
<?php
/**
 * Template Name: Review search (escaped)
 * @package nexus
 */
get_header();

$q   = $_GET['q'];
$url = home_url( '/reviews/?q=' . rawurlencode( $q ) );

echo '<h1>' . esc_html__( 'Results for', 'nexus' ) . '</h1>';
echo esc_html( $q );
?>
<a href="<?php echo esc_url( $url ); ?>" class="search-again"><?php esc_html_e( 'Search again', 'nexus' ); ?></a>
<?php
get_footer();
EOF

# ---------- C2: textContent + constant innerHTML + "eval" in a comment (js, control) ----------
cat > "$D/assets/js/figure-safe.js" <<'EOF'
// Safe badge renderer. We never eval() user input here; everything goes through textContent.
export function renderBadge(el, user) {
  el.textContent = user;
  const badge = document.createElement('span');
  badge.innerHTML = '<b>static</b>';      // constant string, no data
  el.appendChild(badge);
}
EOF

# ---------- C3: $wpdb->prepare then query (php, control) ----------
cat > "$D/inc/queries-safe.php" <<'EOF'
<?php
/**
 * Prepared review queries.
 * @package nexus
 */

function nexus_get_review( $id ) {
	global $wpdb;
	$sql = $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}nexus_reviews WHERE id = %d", $id );
	return $wpdb->get_results( $sql );
}

function nexus_delete_review_safe( $id ) {
	global $wpdb;
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}nexus_reviews WHERE id = %d", $id ) );
}
EOF

# ---------- C4: arrow-function setTimeout, JSON.parse, "eval(" in a comment (js, control) ----------
cat > "$D/assets/js/timers-safe.js" <<'EOF'
// Deferred init (modern). Replaced the old eval( of the config string with JSON.parse.
function doIt() {
  document.body.classList.add('player-ready');
}
export function readConfig(str) {
  return JSON.parse(str);
}
window.addEventListener('load', () => {
  setTimeout(() => doIt(), 100);
  setInterval(doIt, 60000);
});
EOF
echo "generated $(find "$D" -type f | wc -l) files under $D"
