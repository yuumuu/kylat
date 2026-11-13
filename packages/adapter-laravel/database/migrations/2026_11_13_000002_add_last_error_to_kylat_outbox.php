<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('kylat_outbox', function (Blueprint $table): void {
            $table->text('last_error')->nullable()->after('locked_until');
        });
    }

    public function down(): void
    {
        Schema::table('kylat_outbox', function (Blueprint $table): void {
            $table->dropColumn('last_error');
        });
    }
};
