<?php
/**
 * Product card template part with a seeded fault.
 *
 * @package Nexus_Theme
 */

$nexus_post = get_post();
if ( ! $nexus_post instanceof WP_Post ) {
	return;
}
// DEFECT D3 (wrong argument type): wp_trim_words() expects int $num_words, a string is passed.
$nexus_summary = wp_trim_words( $nexus_post->post_content, 'twenty', '…' );
?>
<article class="card" id="post-<?php echo esc_attr( (string) $nexus_post->ID ); ?>">
	<h2 class="card__title"><?php echo esc_html( get_the_title( $nexus_post ) ); ?></h2>
	<p class="card__summary"><?php echo esc_html( $nexus_summary ); ?></p>
	<p class="card__query">
		<?php
		// DEFECT D4 (unescaped output of request data): XSS.
		echo $_GET['q'];
		?>
	</p>
</article>
