<?php
/**
 * Figure partial: one product figure with its key facts.
 * Expects $figure = array( 'title' => string, 'kind' => string, 'price' => float, 'weight_kg' => float ).
 */
require_once __DIR__ . '/../inc/compat.php';
require_once __DIR__ . '/../inc/helpers.php';
?>
<figure class="nexus-figure">
	<h3><?php echo esc_html( $figure['title'] ); ?></h3>
	<dl>
		<dt>Kind</dt>
		<dd><?php echo esc_html( nexus_kind_label( $figure['kind'] ) ); ?></dd>
		<dt>Price</dt>
		<dd><?php echo esc_html( nexus_format_price( $figure['price'] ) ); ?></dd>
		<dt>Pack weight</dt>
		<dd><?php echo esc_html( $figure['weight_kg'] ); ?> kg</dd>
	</dl>
</figure>
