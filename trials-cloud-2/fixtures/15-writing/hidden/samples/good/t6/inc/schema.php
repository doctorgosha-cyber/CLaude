<?php
/**
 * JSON-LD builders.
 */

/**
 * Average rating for a product from its review rows, rounded to one decimal.
 * Returns null when there are no reviews.
 *
 * @param array $reviews Each row has 'rating' (1..5).
 */
function nexus_rating_value( array $reviews ): ?float {
	if ( empty( $reviews ) ) {
		return null;
	}
	$sum = 0.0;
	foreach ( $reviews as $r ) {
		$sum += (float) $r['rating'];
	}
	return round( $sum / count( $reviews ), 1 );
}

/**
 * Product schema with an AggregateRating when reviews exist.
 */
function nexus_product_schema( array $product, array $reviews ): array {
	$schema = array(
		'@context' => 'https://schema.org',
		'@type'    => 'Product',
		'name'     => $product['name'],
	);
	$rating = nexus_rating_value( $reviews );
	if ( null !== $rating ) {
		$schema['aggregateRating'] = array(
			'@type'       => 'AggregateRating',
			'ratingValue' => $rating,
			'reviewCount' => count( $reviews ),
		);
	}
	return $schema;
}
