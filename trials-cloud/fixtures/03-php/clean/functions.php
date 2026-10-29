<?php
/**
 * Theme setup and helpers.
 *
 * @package Nexus_Theme
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register theme supports and menus.
 *
 * @return void
 */
function nexus_theme_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	register_nav_menus(
		array(
			'primary' => __( 'Primary menu', 'nexus' ),
		)
	);
}
add_action( 'after_setup_theme', 'nexus_theme_setup' );

/**
 * Enqueue the theme stylesheet.
 *
 * @return void
 */
function nexus_enqueue_assets() {
	wp_enqueue_style( 'nexus-style', get_stylesheet_uri(), array(), '1.0.0' );
}
add_action( 'wp_enqueue_scripts', 'nexus_enqueue_assets' );

/**
 * Return the product rating for a post, or null when none is stored.
 *
 * @param int $post_id Post ID.
 * @return float|null
 */
function nexus_get_rating( $post_id ) {
	$raw = get_post_meta( $post_id, 'nexus_rating', true );
	if ( '' === $raw || ! is_numeric( $raw ) ) {
		return null;
	}
	return (float) $raw;
}

/**
 * Print the rating badge for the current post.
 *
 * @return void
 */
function nexus_the_rating_badge() {
	$rating = nexus_get_rating( get_the_ID() );
	if ( null === $rating ) {
		return;
	}
	printf(
		'<span class="rating">%s</span>',
		esc_html( number_format_i18n( $rating, 1 ) )
	);
}
