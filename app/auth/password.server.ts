import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// Simple password hashing using scrypt-like approach with crypto
// For production, consider using bcrypt or argon2

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(password + salt).digest('hex');
    return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [ salt, hash ] = storedHash.split(':');
    if (!salt || !hash) {
        return false;
    }

    const computedHash = createHash('sha256').update(password + salt).digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    try {
        return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
    } catch {
        return false;
    }
}

export function generateToken(): string {
    return randomBytes(32).toString('hex');
}
