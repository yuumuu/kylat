<?php

declare(strict_types=1);

namespace Kylat\Laravel\Console;

use Illuminate\Console\Command;
use Kylat\Laravel\Support\IdempotencyConnection;
use Kylat\Laravel\Support\OutboxHandlerRegistry;
use Kylat\Laravel\Support\OutboxRelayRunner;

/**
 * Menjalankan relay outbox sekali (cocok untuk scheduler setiap menit):
 *
 *   php artisan kylat:outbox:relay --max=1000
 *
 * Untuk worker terus-menerus, jalankan command ini dari supervisor/loop.
 */
final class RelayOutboxCommand extends Command
{
    protected $signature = 'kylat:outbox:relay
        {--max=1000 : Jumlah maksimum event yang diproses pada eksekusi ini}
        {--max-attempts=5 : Batas percobaan sebelum event ditandai failed}
        {--lease=60 : Lease klaim worker dalam detik}';

    protected $description = 'Memproses event outbox Kylat yang tertunda';

    public function handle(OutboxHandlerRegistry $handlers): int
    {
        $pdo = IdempotencyConnection::resolve();
        if ($pdo === null) {
            $this->error('Koneksi database Laravel tidak tersedia untuk relay outbox.');

            return self::FAILURE;
        }

        $runner = new OutboxRelayRunner(
            $pdo,
            $handlers,
            max(1, (int) $this->option('max-attempts')),
            max(1, (int) $this->option('lease'))
        );

        $processed = $runner->run(max(0, (int) $this->option('max')));
        $this->info("Relay outbox selesai: {$processed} event diproses.");

        return self::SUCCESS;
    }
}
