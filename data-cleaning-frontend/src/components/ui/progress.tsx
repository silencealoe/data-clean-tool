import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "../../lib/utils"

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
    // 添加调试日志
    React.useEffect(() => {
        console.log('Progress component value:', value);
    }, [value]);

    return (
        <ProgressPrimitive.Root
            ref={ref}
            className={cn(
                "relative h-4 w-full overflow-hidden rounded-full bg-secondary shadow-inner",
                className
            )}
            {...props}
        >
            <ProgressPrimitive.Indicator
                className="h-full w-full flex-1 bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out relative overflow-hidden"
                style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
            >
                {/* 添加光泽效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                {/* 添加流动效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse [animation-duration:2s]" />
            </ProgressPrimitive.Indicator>
        </ProgressPrimitive.Root>
    );
});
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }