<?php

declare(strict_types=1);

namespace Kylat\SpikeS3\Common;

abstract class Component
{
    /**
     * Helper untuk memanggil aksi server dengan jaminan keamanan tipe (type-safe).
     *
     * @template T of object
     * @param class-string<T> $contract
     * @return T
     */
    public function server(string $contract): object
    {
        /** @var T $proxy */
        $proxy = new class ($contract) {
            public function __construct(private string $contract) {}

            /**
             * @param string $name
             * @param array<mixed> $args
             * @return mixed
             */
            public function __call(string $name, array $args): mixed
            {
                unset($this->contract, $name, $args);
                return null;
            }
        };

        return $proxy;
    }
}
