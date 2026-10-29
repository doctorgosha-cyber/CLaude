<?php
/**
 * Figure link card.
 * @package nexus
 */
$url   = get_post_meta( get_the_ID(), 'nexus_figure_url', true );
$title = get_the_title();
?>
<div class="figure-card">
	<a href="<?php echo $url; ?>" class="figure-link"><?php echo esc_html( $title ); ?></a>   <!-- S8 -->
	<span class="figure-card__meta"><?php echo esc_html( get_the_date() ); ?></span>
</div>
