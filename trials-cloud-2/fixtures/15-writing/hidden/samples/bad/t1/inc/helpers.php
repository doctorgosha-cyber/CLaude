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

function nexus_format_weight( float $kg ): string {
	if ( $kg < 1 ) {
		return round( $kg * 1000 ) . ' g';
	}
	return round( $kg, 1 ) . ' kg';
}
