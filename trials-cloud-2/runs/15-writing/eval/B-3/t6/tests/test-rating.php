<?php
/**
 * Plain PHP smoke test. Run: php tests/test-rating.php  (exit 0 = pass)
 */
require_once __DIR__ . '/../functions.php';

$reviews = array( array( 'rating' => 5 ), array( 'rating' => 4 ), array( 'rating' => 4 ) );

$r = nexus_rating_value( $reviews );
if ( 4.3 !== $r ) {
	fwrite( STDERR, "rating: expected 4.3, got " . var_export( $r, true ) . "\n" );
	exit( 1 );
}
if ( null !== nexus_rating_value( array() ) ) {
	fwrite( STDERR, "rating: expected null for no reviews\n" );
	exit( 1 );
}
$s = nexus_product_schema( array( 'name' => 'X' ), $reviews );
if ( 4.3 !== $s['aggregateRating']['ratingValue'] || 3 !== $s['aggregateRating']['reviewCount'] ) {
	fwrite( STDERR, "schema: aggregateRating wrong\n" );
	exit( 1 );
}
if ( '★★★★☆ 4.3' !== nexus_rating_stars( $reviews ) ) {
	fwrite( STDERR, "stars: got " . nexus_rating_stars( $reviews ) . "\n" );
	exit( 1 );
}
echo "ok\n";
