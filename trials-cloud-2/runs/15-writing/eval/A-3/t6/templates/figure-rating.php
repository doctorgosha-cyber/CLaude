<?php
/**
 * Rating bar partial for figure pages. Expects $reviews.
 */
require_once __DIR__ . '/../inc/compat.php';
require_once __DIR__ . '/../inc/schema.php';
$rating = nexus_rating_value( $reviews );
$width  = null === $rating ? 0 : (int) round( $rating / 5 * 100 );
?>
<div class="nexus-rating-bar" aria-label="Rating <?php echo esc_attr( null === $rating ? 'none' : $rating ); ?>">
	<span class="fill" style="width: <?php echo (int) $width; ?>%"></span>
</div>
