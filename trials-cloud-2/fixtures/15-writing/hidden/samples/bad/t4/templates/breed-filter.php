<?php
require_once __DIR__ . '/../inc/compat.php';

$current = ! empty( $_GET['breed'] ) ? $_GET['breed'] : 'all';
?>
<div class="nexus-breed-filter" data-breed="<?php echo $current; ?>">
	<h2>Showing results for <?php echo esc_html( $current ); ?></h2>
	<form method="get" action="">
		<input type="hidden" name="breed" value="<?= $current ?>">
		<label for="weight">Weight (kg)</label>
		<input type="number" id="weight" name="weight" min="1" max="90" step="0.5">
		<button type="submit">Recalculate</button>
	</form>
</div>
