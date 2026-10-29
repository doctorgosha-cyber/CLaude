<?php
/**
 * General helpers for the nexus-flat theme. One topic per file; this is the bag.
 */

/**
 * Format a price for display: "12.50 EUR".
 */
function nexus_format_price( float $amount, string $currency = 'EUR' ): string {
	return number_format( $amount, 2, '.', '' ) . ' ' . $currency;
}

/**
 * Human label for a product kind slug.
 */
function nexus_kind_label( string $kind ): string {
	$labels = array(
		'dry'  => 'Dry food',
		'wet'  => 'Wet food',
		'raw'  => 'Raw',
	);
	return $labels[ $kind ] ?? ucfirst( $kind );
}

/**
 * Format a pack weight for display: "850 g" under 1 kg, "12.5 kg" at 1 kg and over.
 */
function nexus_format_weight( float $kg ): string {
	if ( $kg < 1 ) {
		return (int) round( $kg * 1000 ) . ' g';
	}
	return number_format( $kg, 1, '.', '' ) . ' kg';
}
