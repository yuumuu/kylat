<?php

declare(strict_types=1);

namespace Kylat\Laravel;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Kylat\Laravel\Blade\KylatDirective;
use Kylat\Laravel\Http\Controllers\KylatBatchCallController;

/**
 * Service provider integrasi Kylat ke Laravel.
 *
 * Mendaftarkan direktif Blade, route RPC, dan auto-discovery melalui
 * extra.laravel.providers di composer.json.
 */
final class KylatServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/kylat.php', 'kylat');
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__ . '/../config/kylat.php' => config_path('kylat.php'),
        ], 'kylat-config');

        Blade::directive('kylat', function (string $expression): string {
            return "<?php echo \\Kylat\\Laravel\\Blade\\KylatDirective::renderIsland({$expression}); ?>";
        });

        Blade::directive('kylatScripts', function (): string {
            return "<?php echo \\Kylat\\Laravel\\Blade\\KylatDirective::renderScripts(); ?>";
        });

        Route::post('/_kylat/call', [KylatBatchCallController::class, 'handleRequest'])
            ->middleware(['web'])
            ->name('kylat.call');

        Route::get('/_kylat/read/{action}', [KylatBatchCallController::class, 'handleReadRequest'])
            ->middleware(['web'])
            ->name('kylat.read');

        Route::get('/_kylat/schema', [KylatBatchCallController::class, 'handleSchemaRequest'])
            ->middleware(['web'])
            ->name('kylat.schema');
    }
}
