<?php
/**
 * Vote form handler with a seeded fault.
 *
 * @package Nexus_Theme
 */

/**
 * Handles the vote form submission.
 */
class Nexus_Vote_Form {

	/**
	 * Hook the handler.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_post_nexus_vote', array( $this, 'handle' ) );
	}

	/**
	 * Handle the POST request.
	 *
	 * @return void
	 */
	public function handle() {
		// DEFECT D5 (missing nonce check): $_POST is processed and an option is written without wp_verify_nonce().
		$post_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;
		$vote    = isset( $_POST['vote'] ) ? sanitize_key( wp_unslash( $_POST['vote'] ) ) : '';
		if ( 0 === $post_id || ! in_array( $vote, array( 'up', 'down' ), true ) ) {
			wp_die( esc_html__( 'Invalid request.', 'nexus' ) );
		}
		$count = (int) get_post_meta( $post_id, 'nexus_vote_' . $vote, true );
		update_post_meta( $post_id, 'nexus_vote_' . $vote, $count + 1 );
		wp_safe_redirect( get_permalink( $post_id ) );
		exit;
	}
}
