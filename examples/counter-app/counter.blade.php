<div class="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md space-y-4">
    <h2 class="text-xl font-bold text-gray-900">Kylat Counter Island</h2>
    <div class="flex items-center space-x-4">
        <button on:click="decrement()" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">-</button>
        <span class="text-2xl font-mono">{{ $count }}</span>
        <button on:click="increment()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">+</button>
    </div>
    <div>
        <button on:click="syncToServer()" class="w-full mt-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium">
            Simpan ke Server (RPC)
        </button>
    </div>
</div>
