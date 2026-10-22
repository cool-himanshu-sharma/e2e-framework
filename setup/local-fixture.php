<?php
// Puts the LocalWP site into the state the tests expect. Generic: works for any plugin.
// Run via: npm run local:fixture (also runs before every test run, and from npm run setup).
// Plugin-specific needs go in plugin/e2e.config.json (companion plugins) and plugin/fixture.php (content, options).
define( 'WP_USE_THEMES', false );
require getenv( 'WP_ROOT' ) . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';

function e2e_fail( $message ) {
	fwrite( STDERR, $message . "\n" );
	exit( 1 );
}

// Activates a plugin by its folder slug (e.g. "elementor"); returns its display name.
function e2e_activate( $slug, $why ) {
	$found = null;
	foreach ( get_plugins() as $file => $data ) {
		if ( 0 === strpos( $file, $slug . '/' ) || $file === $slug . '.php' ) {
			$found = [ $file, $data['Name'] ];
			break;
		}
	}
	if ( ! $found ) {
		e2e_fail( "$why needs the plugin \"$slug\", but it is not installed on this site. Install it in wp-admin > Plugins, then run this again." );
	}
	e2e_activate_file( $found[0] );
	return $found[1];
}

function e2e_activate_file( $file ) {
	if ( ! is_plugin_active( $file ) ) {
		$result = activate_plugin( $file );
		if ( is_wp_error( $result ) ) {
			e2e_fail( "Could not activate $file: " . $result->get_error_message() );
		}
	}
}

// 1. Dedicated admin account for the suite, so nobody's own login is needed.
$user = get_user_by( 'login', 'e2e_admin' );
$uid  = $user ? $user->ID : wp_insert_user( [ 'user_login' => 'e2e_admin', 'user_pass' => 'e2e_admin_pass', 'user_email' => 'e2e_admin@example.com', 'role' => 'administrator' ] );
if ( is_wp_error( $uid ) ) {
	e2e_fail( 'Could not create e2e_admin: ' . $uid->get_error_message() );
}
wp_set_password( 'e2e_admin_pass', $uid );
echo "E2E admin user ready: e2e_admin / e2e_admin_pass\n";

// 2. The plugin under test: the folder that contains the framework. Prefer <slug>/<slug>.php when there are several PHP headers.
$slug    = basename( getenv( 'PLUGIN_DIR' ) );
$plugins = get_plugins( '/' . $slug );
if ( ! $plugins ) {
	e2e_fail( "No plugin header found in wp-content/plugins/$slug." );
}
$main = isset( $plugins[ $slug . '.php' ] ) ? $slug . '.php' : array_key_first( $plugins );
$file = $slug . '/' . $main;

// 3. Companion plugins first: the plugin's "Requires Plugins" header plus plugin/e2e.config.json "requiredPlugins".
$config = [];
$config_file = getenv( 'E2E_DIR' ) . '/plugin/e2e.config.json';
if ( file_exists( $config_file ) ) {
	$config = json_decode( file_get_contents( $config_file ), true );
	if ( ! is_array( $config ) ) {
		e2e_fail( 'plugin/e2e.config.json is not valid JSON.' );
	}
}
$required = array_filter( array_unique( array_merge(
	array_map( 'trim', explode( ',', (string) ( $plugins[ $main ]['RequiresPlugins'] ?? '' ) ) ),
	(array) ( $config['requiredPlugins'] ?? [] )
) ) );
foreach ( $required as $required_slug ) {
	echo 'Required plugin active: ' . e2e_activate( $required_slug, $plugins[ $main ]['Name'] ) . "\n";
}

// 4. Activate the plugin under test.
e2e_activate_file( $file );
echo 'Plugin active: ' . $plugins[ $main ]['Name'] . " ($file)\n";

// 5. Plugin-specific fixture.
$plugin_fixture = getenv( 'E2E_DIR' ) . '/plugin/fixture.php';
if ( file_exists( $plugin_fixture ) ) {
	require $plugin_fixture;
}

// Marker setup.mjs looks for: WordPress exits 0 even when it dies, so the exit code alone proves nothing.
echo "E2E_SITE_READY\n";
