<?php

declare(strict_types=1);

namespace App\Actions;

/**
 * Interface kontrak aksi server untuk Counter.
 * Mengikuti prinsip Spike S3 dan keamanan default-deny.
 */
interface CounterActions
{
    /**
     * Memeriksa otorisasi pemanggil aksi (default deny).
     */
    public function authorize(): bool;

    /**
     * Menyimpan nilai count ke backend.
     */
    public function saveCount(int $count): bool;
}
