import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "../../lib/utils"

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        className={cn(
            "relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 shadow-inner",
            className
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className="h-full w-full flex-1 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out relative overflow-hidden"
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        >
            {/* 添加光泽效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            {/* 添加流动效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse [animation-duration:2s]" />
        </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }