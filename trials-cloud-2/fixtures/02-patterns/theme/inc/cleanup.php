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
