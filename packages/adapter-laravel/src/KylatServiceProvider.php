<?php

declare(strict_types=1);

namespace Kylat\Laravel;

use Kylat\Laravel\Blade\KylatDirective;
use Kylat\Laravel\Http\Controllers\KylatBatchCallController;

/**
 * Service Provider integrasi Kylat ke ekosistem Laravel.
 */
class KylatServiceProvider
{
    /**
     * Mendaftarkan direktif Blade jika Illuminate\Support\Facades\Blade tersedia.
     */
    public function boot(): void
    {
        if (class_exists(\Illuminate\Support\Facades\Blade::class)) {
            \Illuminate\Support\Facades\Blade::directive('kylat', function (string $expression) {
                return "<?php echo \\Kylat\\Laravel\\Blade\\KylatDirective::renderIsland({$expression}); ?>";
            });

            \Illuminate\Support\Facades\Blade::directive('kylatScripts', function () {
                return "<?php echo \\Kylat\\Laravel\\Blade\\KylatDirective::renderScripts(); ?>";
            });
        }

        if (class_exists(\Illuminate\Support\Facades\Route::class)) {
            \Illuminate\Support\Facades\Route::post('/_kylat/call', [KylatBatchCallController::class, 'handle'])
                ->middleware(['web']);
        }
    }

    public function register(): void
    {
        // Bindings container jika diperlukan
    }
}
