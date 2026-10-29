<?php
/**
 * Review card partial. Expects $product (array) and $reviews (array of rows).
 */
require_once __DIR__ . '/../inc/compat.php';
require_once __DIR__ . '/../inc/helpers.php';
require_once __DIR__ . '/../inc/schema.php';
$rating = nexus_get_rating( $reviews );
?>
<article class="nexus-review-card">
	<h3><?php echo esc_html( $product['name'] ); ?></h3>
	<p class="stars"><?php echo esc_html( nexus_rating_stars( $reviews ) ); ?></p>
	<?php if ( null !== $rating ) : ?>
	<meta itemprop="ratingValue" content="<?php echo esc_attr( $rating ); ?>">
	<?php endif; ?>
</article>
