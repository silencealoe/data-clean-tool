import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('utils', () => {
    describe('cn', () => {
        it('should merge class names correctly', () => {
            expect(cn('px-2 py-1', 'bg-red-500')).toBe('px-2 py-1 bg-red-500')
        })

        it('should handle conditional classes', () => {
            const condition1 = true;
            const condition2 = false;
            expect(cn('px-2', condition1 && 'py-1', condition2 && 'bg-red-500')).toBe('px-2 py-1')
        })

        it('should merge conflicting classes correctly', () => {
            expect(cn('px-2 px-4')).toBe('px-4')
        })
    })
})