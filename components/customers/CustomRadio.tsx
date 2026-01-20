import React from "react";
import {
    RadioProps,
    useRadio,
    cn,
    VisuallyHidden,
} from "@heroui/react";

const CustomRadio = (props: RadioProps) => {
    const {
        Component, children, isSelected, description,
        getBaseProps, getWrapperProps, getInputProps,
    } = useRadio(props);

    return (
        <Component
            {...getBaseProps()}
            className={cn(
                "group inline-flex items-center hover:bg-content2",
                "max-w-full cursor-pointer border-2 border-default-200 rounded-xl gap-4 p-4",
                "data-[selected=true]:border-secondary data-[selected=true]:bg-secondary-50/50",
            )}
        >
            <VisuallyHidden>
                <input {...getInputProps()} />
            </VisuallyHidden>
            <div className="flex flex-col gap-1">
                {children && <span className="font-semibold text-sm">{children}</span>}
                {description && (
                    <span className="text-tiny text-default-400">{description}</span>
                )}
            </div>
        </Component>
    );
};

export default CustomRadio;
