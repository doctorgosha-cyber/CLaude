<?php
/**
 * Breed filter partial for the calculator page.
 * Renders the current breed in the heading, carries it in the form, and tags the wrapper for JS.
 */
require_once __DIR__ . '/../inc/compat.php';

$current = isset( $_GET['breed'] ) ? sanitize_key( $_GET['breed'] ) : 'all';
if ( '' === $current ) {
	$current = 'all';
}
?>
<div class="nexus-breed-filter" data-breed="<?php echo esc_attr( $current ); ?>">
	<h2>Showing results for <?php echo esc_html( $current ); ?></h2>
	<form method="get" action="">
		<input type="hidden" name="breed" value="<?php echo esc_attr( $current ); ?>">
		<label for="weight">Weight (kg)</label>
		<input type="number" id="weight" name="weight" min="1" max="90" step="0.5">
		<button type="submit">Recalculate</button>
	</form>
</div>
