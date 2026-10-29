<?php
/**
 * Minimal contact form handler.
 *
 * @package Nexus_Theme
 */

/**
 * Handles the contact form submission.
 */
class Nexus_Contact_Form {

	/**
	 * Option name used to count submissions.
	 *
	 * @var string
	 */
	private $option = 'nexus_contact_count';

	/**
	 * Hook the handler.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_post_nexus_contact', array( $this, 'handle' ) );
	}

	/**
	 * Handle the POST request.
	 *
	 * @return void
	 */
	public function handle() {
		if ( ! isset( $_POST['nexus_nonce'] ) || ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST['nexus_nonce'] ) ), 'nexus_contact' ) ) {
			wp_die( esc_html__( 'Invalid request.', 'nexus' ) );
		}
		$email = isset( $_POST['email'] ) ? sanitize_email( wp_unslash( $_POST['email'] ) ) : '';
		if ( ! is_email( $email ) ) {
			wp_safe_redirect( add_query_arg( 'contact', 'invalid', home_url( '/' ) ) );
			exit;
		}
		$count = (int) get_option( $this->option, 0 );
		update_option( $this->option, $count + 1 );
		wp_safe_redirect( add_query_arg( 'contact', 'sent', home_url( '/' ) ) );
		exit;
	}
}
