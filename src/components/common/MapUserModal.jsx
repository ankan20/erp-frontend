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
                        handleCheckbox(permissionKey, "view", e.target.checked)
                    }
                    className="h-3.5 w-3.5 cursor-pointer"
                />
            </div>

            <div className="flex items-center justify-center">
                <input
                    type="checkbox"
                    checked={permissions?.[permissionKey]?.edit || false}
                    onChange={(e) =>
                        handleCheckbox(permissionKey, "edit", e.target.checked)
                    }
                    className="h-3.5 w-3.5 cursor-pointer"
                />
            </div>
        </div>
    );
}

// Collect all permission keys from a subtree (same traversal logic as renderPermissionTree)
function collectKeys(items = []) {
    const keys = [];
    items.forEach((item) => {
        if (item.children?.length > 0) {
            if (item.showChildrenInPermission === false) {
                const key =
                    item.permissionKey ||
                    item.children?.find((c) => c.permissionKey)?.permissionKey;
                if (key) keys.push(key);
            } else {
                keys.push(...collectKeys(item.children));
            }
        } else {
            const key = item.permissionKey;
            if (key) keys.push(key);
        }
    });
    return keys;
}


export default function MapUserModal({
                                         open,
                                         onOpenChange,
                                         loading,
                                         permissions,
                                         setPermissions,
                                         onSave,
                                     }) {
    const visibleModules = sidebarConfig.filter((m) => !m.hideInPermissions);

    const handleCheckbox = (permissionKey, permissionType, checked) => {
        if (!permissionKey) return;

        setPermissions((prev) => {
            const current = prev[permissionKey] || { view: false, edit: false };

            if (permissionType === "edit" && checked) {
                return { ...prev, [permissionKey]: { ...current, edit: true, view: true } };
            }

            if (permissionType === "view" && !checked && current.edit) {
                return prev;
            }

            return { ...prev, [permissionKey]: { ...current, [permissionType]: checked } };
        });
    };

    // Check if all keys in a list are fully selected (view+edit both true)
    const isAllSelected = (keys) =>
        keys.length > 0 && keys.every((k) => permissions?.[k]?.view && permissions?.[k]?.edit);

    // Select all keys in a list
    const selectKeys = (keys) => {
        setPermissions((prev) => {
            const next = { ...prev };
            keys.forEach((k) => { next[k] = { view: true, edit: true }; });
            return next;
        });
    };

    // Deselect all keys in a list
    const deselectKeys = (keys) => {
        setPermissions((prev) => {
            const next = { ...prev };
            keys.forEach((k) => { next[k] = { view: false, edit: false }; });
            return next;
        });
    };

    const allKeys = visibleModules.flatMap((m) => collectKeys(m.children || []));
    const globalAllSelected = isAllSelected(allKeys);

    const handleGlobalToggle = () => {
        if (globalAllSelected) deselectKeys(allKeys);
        else selectKeys(allKeys);
    };

    const handleModuleToggle = (moduleKeys) => {
        if (isAllSelected(moduleKeys)) deselectKeys(moduleKeys);
        else selectKeys(moduleKeys);
    };

    const renderPermissionTree = (items = [], serial = "") => {
        return items.map((item, index) => {
            const currentSerial = serial ? `${serial}.${index + 1}` : `${index + 1}`;

            if (item.children?.length > 0) {
                if (item.showChildrenInPermission === false) {
                    const accessKey =
                        item.permissionKey ||
                        item.children?.find((child) => child.permissionKey)?.permissionKey;

                    return (
                        <div key={`${item.title}-${currentSerial}`} className="grid grid-cols-[1fr_70px_90px] border-b border-[#cfcfcf] bg-[#d7ebcd] text-[12px] font-semibold">
                            <div className="border-r border-[#cfcfcf] px-2 py-1">
                                {currentSerial} {item.title}
                            </div>
                            <div className="flex items-center justify-center border-r border-[#cfcfcf]">
                                <input
                                    type="checkbox"
                                    checked={permissions?.[accessKey]?.view || false}
                                    disabled={permissions?.[accessKey]?.edit || false}
                                    onChange={(e) => handleCheckbox(accessKey, "view", e.target.checked)}
                                    className="h-3.5 w-3.5 cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={permissions?.[accessKey]?.edit || false}
                                    onChange={(e) => handleCheckbox(accessKey, "edit", e.target.checked)}
                                    className="h-3.5 w-3.5 cursor-pointer"
                                />
                            </div>
                        </div>
                    );
                }

                const sectionKeys = collectKeys(item.children);
                const sectionSelected = isAllSelected(sectionKeys);

                return (
                    <div key={`${item.title}-${currentSerial}`}>
                        <div className="border-b border-[#cfcfcf] bg-[#d7ebcd] px-2 py-1 text-[12px] font-semibold flex items-center justify-between">
                            <span>{currentSerial} {item.title}</span>
                            {sectionKeys.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (sectionSelected) deselectKeys(sectionKeys);
                                        else selectKeys(sectionKeys);
                                    }}
                                    className={`px-2 py-0.5 text-[10px] font-semibold border rounded-sm transition ${
                                        sectionSelected
                                            ? "bg-red-100 border-red-400 text-red-700 hover:bg-red-200"
                                            : "bg-white border-[#5b6b8c] text-[#5b6b8c] hover:bg-blue-50"
                                    }`}
                                >
                                    {sectionSelected ? "Deselect All" : "Select All"}
                                </button>
                            )}
                        </div>
                        {renderPermissionTree(item.children, currentSerial)}
                    </div>
                );
            }

            return (
                <PermissionRow
                    key={`${item.title}-${currentSerial}`}
                    title={item.title}
                    permissionKey={item.permissionKey}
                    serialNo={currentSerial}
                    permissions={permissions}
                    handleCheckbox={handleCheckbox}
                />
            );
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="!w-[95vw] !max-w-[900px] !p-0 !overflow-hidden !rounded-sm !border !border-[#cfcfcf] bg-[#efefef]"
            >
                <DialogHeader className="flex flex-row items-center justify-between border-b border-[#cfcfcf] bg-white px-3 py-2">
                    <DialogTitle className="text-[14px] font-bold text-black">
                        Module Permission Mapping
                    </DialogTitle>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleGlobalToggle}
                            className={`px-3 py-1 text-[11px] font-semibold border rounded-sm transition ${
                                globalAllSelected
                                    ? "bg-red-100 border-red-400 text-red-700 hover:bg-red-200"
                                    : "bg-green-100 border-green-500 text-green-700 hover:bg-green-200"
                            }`}
                        >
                            {globalAllSelected ? "Deselect All" : "Select All"}
                        </button>

                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-sm border border-[#cfcfcf] p-1 hover:bg-gray-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
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
                        {visibleModules.map((module, moduleIndex) => {
                            const moduleKeys = collectKeys(module.children || []);
                            const moduleSelected = isAllSelected(moduleKeys);

                            return (
                                <div key={module.title}>
                                    <div className="border-b border-[#cfcfcf] bg-[#c8e3ef] px-2 py-1 text-[12px] font-bold flex items-center justify-between">
                                        <span>{moduleIndex + 1}. {module.title}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleModuleToggle(moduleKeys)}
                                            className={`px-2 py-0.5 text-[10px] font-semibold border rounded-sm transition ${
                                                moduleSelected
                                                    ? "bg-red-100 border-red-400 text-red-700 hover:bg-red-200"
                                                    : "bg-white border-[#5b6b8c] text-[#5b6b8c] hover:bg-blue-50"
                                            }`}
                                        >
                                            {moduleSelected ? "Deselect All" : "Select All"}
                                        </button>
                                    </div>

                                    {renderPermissionTree(
                                        module.children || [],
                                        `${moduleIndex + 1}`
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-[#cfcfcf] bg-white px-3 py-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="min-w-[100px] border border-[#7a7a7a] bg-white px-3 py-1 text-[12px] hover:bg-gray-100"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onSave}
                        disabled={loading}
                        className="min-w-[100px] border border-[#1d4ed8] bg-[#2f64d6] px-3 py-1 text-[12px] text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
