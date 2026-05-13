"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { sidebarConfig } from "@/config/sidebar.config";
import { X, Settings, Database } from "lucide-react";

export default function MapUserModal({
                                         open,
                                         onOpenChange,
                                         loading,
                                         permissions,
                                         setPermissions,
                                         onSave,
                                     }) {

    // HANDLE CHECKBOX
    const handleCheckbox = (
        path,
        permissionType,
        checked
    ) => {
        setPermissions((prev) => ({
            ...prev,

            [path]: {
                ...prev[path],

                [permissionType]: checked,
            },
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>

            <DialogContent
                showCloseButton={false}
                className="
                        !w-[95vw]
                        !max-w-[1400px]
                        !p-0
                        !overflow-hidden
                        !rounded-2xl
                        !border-0
            ">

                <div>
                    {/* HEADER */}
                    <DialogHeader className="flex flex-row items-center justify-between border-b bg-white px-7 py-5">

                        <DialogTitle className="text-[20px] font-bold text-[#11295b] tracking-wide">
                            Module Permission Mapping
                        </DialogTitle>

                        <button
                            onClick={() => onOpenChange(false)}
                            className="rounded-md p-2 hover:bg-gray-100 transition"
                        >
                            <X className="h-5 w-5 text-[#11295b]"/>
                        </button>

                    </DialogHeader>

                    {/* BODY */}
                    <div className="max-h-[70vh] overflow-y-auto bg-[#fafafa] px-5 py-5">

                        {/* TABLE HEADER */}
                        <div
                            className="grid grid-cols-4 overflow-hidden rounded-t-xl border border-[#dbe3ef] bg-[#dfeafb] text-sm font-semibold text-[#1f3768]">

                            <div className="border-r border-[#dbe3ef] px-6 py-4 text-left">
                                Module
                            </div>

                            <div className="border-r border-[#dbe3ef] px-6 py-4 text-center">
                                View
                            </div>

                            <div className="border-r border-[#dbe3ef] px-6 py-4 text-center">
                                Edit
                            </div>

                            <div className="px-6 py-4 text-center">
                                Download
                            </div>

                        </div>

                        {/* MODULES */}
                        <div className="overflow-hidden rounded-b-xl border border-t-0 border-[#dbe3ef] bg-white">

                            {sidebarConfig
                                .filter(
                                    (module) =>
                                        module.title?.toLowerCase() !== "settings" &&
                                        module.title?.toLowerCase() !== "master"
                                )
                                .map((module) => (

                                    <div key={module.title}>

                                        {/* MODULE TITLE */}
                                        <div className="flex items-center gap-2 border-b bg-[#eef3fb] px-5 py-3">

                                            {module.title?.toLowerCase() === "settings" ? (
                                                <Settings className="h-4 w-4 text-[#243b6b]"/>
                                            ) : (
                                                <Database className="h-4 w-4 text-[#243b6b]"/>
                                            )}

                                            <h2 className="text-[15px] font-semibold text-[#243b6b] capitalize">
                                                {module.title}
                                            </h2>

                                        </div>

                                        {/* CHILDREN */}
                                        {module.children?.map((child) => (

                                            <div key={child.title}>

                                                {/* CHILD WITH SUB MENU */}
                                                {child.children ? (

                                                    child.children.map((sub) => (

                                                        <div
                                                            key={sub.path}
                                                            className="grid grid-cols-4 border-b border-[#e5e7eb] text-sm hover:bg-[#f8fbff] transition"
                                                        >

                                                            {/* NAME */}
                                                            <div
                                                                className="border-r border-[#e5e7eb] px-12 py-4 font-medium text-[#2f3b52]">
                                                                {sub.title}
                                                            </div>

                                                            {/* VIEW */}
                                                            <div
                                                                className="flex items-center justify-center border-r border-[#e5e7eb]">

                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        permissions?.[sub.path]
                                                                            ?.view || false
                                                                    }
                                                                    onChange={(e) =>
                                                                        handleCheckbox(
                                                                            sub.path,
                                                                            "view",
                                                                            e.target.checked
                                                                        )
                                                                    }
                                                                    className="h-[18px] w-[18px] cursor-pointer rounded border-gray-400 accent-green-600"
                                                                />

                                                            </div>

                                                            {/* EDIT */}
                                                            <div
                                                                className="flex items-center justify-center border-r border-[#e5e7eb]">

                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        permissions?.[sub.path]
                                                                            ?.edit || false
                                                                    }
                                                                    onChange={(e) =>
                                                                        handleCheckbox(
                                                                            sub.path,
                                                                            "edit",
                                                                            e.target.checked
                                                                        )
                                                                    }
                                                                    className="h-[18px] w-[18px] cursor-pointer rounded border-gray-400 accent-green-600"
                                                                />

                                                            </div>

                                                            {/* DOWNLOAD */}
                                                            <div className="flex items-center justify-center">

                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        permissions?.[sub.path]
                                                                            ?.download || false
                                                                    }
                                                                    onChange={(e) =>
                                                                        handleCheckbox(
                                                                            sub.path,
                                                                            "download",
                                                                            e.target.checked
                                                                        )
                                                                    }
                                                                    className="h-[18px] w-[18px] cursor-pointer rounded border-gray-400 accent-green-600"
                                                                />

                                                            </div>

                                                        </div>
                                                    ))

                                                ) : (

                                                    <div
                                                        className="grid grid-cols-4 border-b border-[#e5e7eb] text-sm hover:bg-[#f8fbff] transition last:border-b-0">

                                                        {/* NAME */}
                                                        <div
                                                            className="border-r border-[#e5e7eb] px-12 py-4 font-medium text-[#2f3b52]">
                                                            {child.title}
                                                        </div>

                                                        {/* VIEW */}
                                                        <div
                                                            className="flex items-center justify-center border-r border-[#e5e7eb]">

                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    permissions?.[child.path]
                                                                        ?.view || false
                                                                }
                                                                onChange={(e) =>
                                                                    handleCheckbox(
                                                                        child.path,
                                                                        "view",
                                                                        e.target.checked
                                                                    )
                                                                }
                                                                className="h-[18px] w-[18px] cursor-pointer rounded border-gray-400 accent-green-600"
                                                            />

                                                        </div>

                                                        {/* EDIT */}
                                                        <div
                                                            className="flex items-center justify-center border-r border-[#e5e7eb]">

                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    permissions?.[child.path]
                                                                        ?.edit || false
                                                                }
                                                                onChange={(e) =>
                                                                    handleCheckbox(
                                                                        child.path,
                                                                        "edit",
                                                                        e.target.checked
                                                                    )
                                                                }
                                                                className="h-[18px] w-[18px] cursor-pointer rounded border-gray-400 accent-green-600"
                                                            />

                                                        </div>

                                                        {/* DOWNLOAD */}
                                                        <div className="flex items-center justify-center">

                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    permissions?.[child.path]
                                                                        ?.download || false
                                                                }
                                                                onChange={(e) =>
                                                                    handleCheckbox(
                                                                        child.path,
                                                                        "download",
                                                                        e.target.checked
                                                                    )
                                                                }
                                                                className="h-[18px] w-[18px] cursor-pointer rounded border-gray-400 accent-green-600"
                                                            />

                                                        </div>

                                                    </div>
                                                )}

                                            </div>
                                        ))}

                                    </div>
                                ))}

                        </div>

                    </div>
                </div>


                {/* FOOTER */}
                <div className="flex justify-end gap-4 border-t bg-white px-7 py-5">

                    {/* CANCEL */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="min-w-[130px] rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#1f2937] transition hover:bg-gray-100"
                    >
                        Cancel
                    </button>

                    {/* SAVE */}
                    <button
                        onClick={onSave}
                        disabled={loading}
                        className="min-w-[130px] rounded-xl bg-[#295dcc] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f4fb5] disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>

                </div>

            </DialogContent>

        </Dialog>
    );
}