<?php
/**
 * Product card template part.
 *
 * @package Nexus_Theme
 */

$nexus_post = get_post();
if ( ! $nexus_post instanceof WP_Post ) {
	return;
}

$nexus_terms = get_the_terms( $nexus_post, 'category' );
$nexus_first = ( is_array( $nexus_terms ) && ! empty( $nexus_terms ) ) ? $nexus_terms[0]->name : '';
$nexus_query = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
?>
<article class="card" id="post-<?php echo esc_attr( (string) $nexus_post->ID ); ?>">
	<h2 class="card__title"><a href="<?php echo esc_url( get_permalink( $nexus_post ) ); ?>"><?php echo esc_html( get_the_title( $nexus_post ) ); ?></a></h2>
	<?php if ( '' !== $nexus_first ) : ?>
		<p class="card__term"><?php echo esc_html( $nexus_first ); ?></p>
	<?php endif; ?>
	<?php if ( '' !== $nexus_query ) : ?>
		<p class="card__query"><?php echo esc_html( $nexus_query ); ?></p>
	<?php endif; ?>
	<div class="card__excerpt"><?php echo wp_kses_post( get_the_excerpt( $nexus_post ) ); ?></div>
</article>
