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
