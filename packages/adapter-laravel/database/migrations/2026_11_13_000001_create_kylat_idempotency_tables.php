<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('kylat_idempotency_keys', function (Blueprint $table): void {
            $table->string('user_id', 255);
            $table->string('key', 128);
            $table->string('action', 255);
            $table->char('payload_hash', 64);
            $table->string('status', 20);
            $table->text('response')->nullable();
            $table->unsignedInteger('attempts')->default(1);
            $table->timestamp('locked_until')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->primary(['user_id', 'key']);
            $table->index('expires_at');
        });

        Schema::create('kylat_outbox', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('event_id')->unique();
            $table->string('event_type', 128);
            $table->text('payload');
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('available_at');
            $table->timestamp('locked_until')->nullable();
            $table->timestamps();

            $table->index(['status', 'available_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kylat_outbox');
        Schema::dropIfExists('kylat_idempotency_keys');
    }
};
