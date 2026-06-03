"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { sidebarConfig } from "@/config/sidebar.config";
import { X } from "lucide-react";

function PermissionRow({
                           title,
                           permissionKey,
                           serialNo,
                           permissions,
                           handleCheckbox,
                       }) {
    if (!permissionKey) return null;

    return (
        <div className="grid grid-cols-[1fr_70px_90px] border-b border-[#cfcfcf] text-[12px]">
            <div className="border-r border-[#cfcfcf] px-2 py-1">
                {serialNo} {title}
            </div>

            <div className="flex items-center justify-center border-r border-[#cfcfcf]">
                <input
                    type="checkbox"
                    checked={permissions?.[permissionKey]?.view || false}
                    disabled={permissions?.[permissionKey]?.edit || false}
                    onChange={(e) =>
                        handleCheckbox(
                            permissionKey,
                            "view",
                            e.target.checked
                        )
                    }
                    className="h-3.5 w-3.5 cursor-pointer"
                />
            </div>

            <div className="flex items-center justify-center">
                <input
                    type="checkbox"
                    checked={permissions?.[permissionKey]?.edit || false}
                    onChange={(e) =>
                        handleCheckbox(
                            permissionKey,
                            "edit",
                            e.target.checked
                        )
                    }
                    className="h-3.5 w-3.5 cursor-pointer"
                />
            </div>
        </div>
    );
}

const renderPermissionTree = (
    items = [],
    serial = "",
    permissions,
    handleCheckbox
) => {
    return items.map((item, index) => {
        const currentSerial = serial
            ? `${serial}.${index + 1}`
            : `${index + 1}`;

        if (item.children?.length > 0) {
            if (item.showChildrenInPermission === false) {
                const accessKey =
                    item.permissionKey ||
                    item.children?.find((child) => child.permissionKey)
                        ?.permissionKey;

                return (
                    <PermissionRow
                        key={`${item.title}-${currentSerial}`}
                        title={item.title}
                        permissionKey={accessKey}
                        serialNo={currentSerial}
                        permissions={permissions}
                        handleCheckbox={handleCheckbox}
                    />
                );
            }

            return (
                <div key={`${item.title}-${currentSerial}`}>
                    <div className="border-b border-[#cfcfcf] bg-[#d7ebcd] px-2 py-1 text-[12px] font-semibold">
                        {currentSerial} {item.title}
                    </div>

                    {renderPermissionTree(
                        item.children,
                        currentSerial,
                        permissions,
                        handleCheckbox
                    )}
                </div>
            );
        }

        return (
            <PermissionRow
                key={`${item.title}-${currentSerial}`}
                title={item.title}
                permissionKey={
                    item.permissionAccessKey || item.permissionKey
                }
                serialNo={currentSerial}
                permissions={permissions}
                handleCheckbox={handleCheckbox}
            />
        );
    });
};

export default function MapUserModal({
                                         open,
                                         onOpenChange,
                                         loading,
                                         permissions,
                                         setPermissions,
                                         onSave,
                                     }) {
    const handleCheckbox = (
        permissionKey,
        permissionType,
        checked
    ) => {
        if (!permissionKey) return;

        setPermissions((prev) => {
            const current =
                prev[permissionKey] || {
                    view: false,
                    edit: false,
                };

            if (
                permissionType === "edit" &&
                checked
            ) {
                return {
                    ...prev,
                    [permissionKey]: {
                        ...current,
                        edit: true,
                        view: true,
                    },
                };
            }

            if (
                permissionType === "view" &&
                !checked &&
                current.edit
            ) {
                return prev;
            }

            return {
                ...prev,
                [permissionKey]: {
                    ...current,
                    [permissionType]: checked,
                },
            };
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent
                showCloseButton={false}
                className="
                    !w-[95vw]
                    !max-w-[900px]
                    !p-0
                    !overflow-hidden
                    !rounded-sm
                    !border
                    !border-[#cfcfcf]
                    bg-[#efefef]
                "
            >
                <DialogHeader
                    className="
                        flex
                        flex-row
                        items-center
                        justify-between
                        border-b
                        border-[#cfcfcf]
                        bg-white
                        px-3
                        py-2
                    "
                >
                    <DialogTitle className="text-[14px] font-bold text-black">
                        Module Permission Mapping
                    </DialogTitle>

                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="
                            rounded-sm
                            border
                            border-[#cfcfcf]
                            p-1
                            hover:bg-gray-100
                        "
                    >
                        <X className="h-4 w-4" />
                    </button>
                </DialogHeader>

                <div className="max-h-[75vh] overflow-y-auto bg-[#efefef] p-3">
                    <div className="grid grid-cols-[1fr_70px_90px] border border-[#cfcfcf] bg-[#c8e3ef] text-[12px] font-bold">
                        <div className="border-r border-[#cfcfcf] px-2 py-1 text-center">
                            Module/Sub Module
                        </div>

                        <div className="border-r border-[#cfcfcf] px-2 py-1 text-center">
                            View
                        </div>

                        <div className="px-2 py-1 text-center">
                            Add/Edit
                        </div>
                    </div>

                    <div className="border border-t-0 border-[#cfcfcf] bg-white">
                        {sidebarConfig.map((module, moduleIndex) => (
                            <div key={module.title}>
                                <div className="border-b border-[#cfcfcf] bg-[#c8e3ef] px-2 py-1 text-[12px] font-bold">
                                    {moduleIndex + 1}. {module.title}
                                </div>

                                {renderPermissionTree(
                                    module.children || [],
                                    `${moduleIndex + 1}`,
                                    permissions,
                                    handleCheckbox
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-[#cfcfcf] bg-white px-3 py-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="
                            min-w-[100px]
                            border
                            border-[#7a7a7a]
                            bg-white
                            px-3
                            py-1
                            text-[12px]
                            hover:bg-gray-100
                        "
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onSave}
                        disabled={loading}
                        className="
                            min-w-[100px]
                            border
                            border-[#1d4ed8]
                            bg-[#2f64d6]
                            px-3
                            py-1
                            text-[12px]
                            text-white
                            hover:bg-[#1d4ed8]
                            disabled:opacity-50
                        "
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}