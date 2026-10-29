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
