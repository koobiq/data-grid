import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

/**
 * Decompresses and decodes a query parameter from its compressed and encoded format.
 *
 * @typeparam T - The expected type of the decompressed data.
 * @param value - The compressed and encoded string to decompress and decode.
 * @returns The decompressed and decoded data of type `T`, or `null` if decompression fails.
 */
export function decompressQueryParam<T>(value: string): T | null {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(decompressFromEncodedURIComponent(value));
    } catch (e) {
        console.error('Failed to decode state', e);
        return null;
    }
}

/**
 * Compresses and encodes a value to be safely used as a query parameter.
 *
 * @param value - The value to compress and encode. Can be any serializable data.
 * @returns A compressed and encoded string representing the input value.
 */
export function compressQueryParam(value: any) {
    return compressToEncodedURIComponent(JSON.stringify(value));
}
