<?php
/**
 * General helpers for the nexus-flat theme.
 */

/**
 * Star string for a product, e.g. "★★★★☆ 4.2".
 */
function nexus_rating_stars( array $reviews ): string {
	$rating = nexus_get_rating( $reviews );
	if ( null === $rating ) {
		return 'No reviews yet';
	}
	$full = (int) floor( $rating );
	return str_repeat( '★', $full ) . str_repeat( '☆', 5 - $full ) . ' ' . number_format( $rating, 1 );
}
