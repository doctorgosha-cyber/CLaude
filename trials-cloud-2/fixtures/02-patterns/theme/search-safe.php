<?php
/**
 * Template Name: Review search (escaped)
 * @package nexus
 */
get_header();

$q   = $_GET['q'];
$url = home_url( '/reviews/?q=' . rawurlencode( $q ) );

echo '<h1>' . esc_html__( 'Results for', 'nexus' ) . '</h1>';
echo esc_html( $q );
?>
<a href="<?php echo esc_url( $url ); ?>" class="search-again"><?php esc_html_e( 'Search again', 'nexus' ); ?></a>
<?php
get_footer();
