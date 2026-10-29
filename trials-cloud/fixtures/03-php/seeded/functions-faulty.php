<?php
/**
 * Theme helpers with two seeded faults.
 *
 * @package Nexus_Theme
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the title of the parent post.
 *
 * @param int $post_id Post ID.
 * @return string
 */
function nexus_parent_title( $post_id ) {
	$post = get_post( $post_id );
	// DEFECT D1 (null dereference): get_post() returns WP_Post|null; $post->post_parent crashes on null.
	$parent = get_post( $post->post_parent );
	return (string) $parent->post_title;
}

/**
 * Build the badge label.
 *
 * @param float $rating Rating.
 * @return string
 */
function nexus_badge_label( $rating ) {
	if ( $rating >= 4.5 ) {
		$label = 'Top pick';
	} elseif ( $rating >= 3.5 ) {
		$label = 'Good';
	}
	// DEFECT D2 (undefined variable): $label is undefined when $rating < 3.5.
	return $label;
}
