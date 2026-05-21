"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { sidebarConfig } from "@/config/sidebar.config";

import { X } from "lucide-react";

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

        setPermissions((prev) => {

            const current =
                prev[path] || {
                    view: false,
                    edit: false,
                };

            // AUTO ENABLE VIEW
            // WHEN EDIT IS CHECKED

            if (
                permissionType === "edit" &&
                checked
            ) {

                return {

                    ...prev,

                    [path]: {

                        ...current,

                        edit: true,

                        view: true,

                    },

                };
            }

            // NORMAL FLOW

            return {

                ...prev,

                [path]: {

                    ...current,

                    [permissionType]:
                    checked,

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

                {/* HEADER */}
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

                    <DialogTitle
                        className="
                            text-[14px]
                            font-bold
                            text-black
                        "
                    >
                        Module Permission Mapping
                    </DialogTitle>

                    <button
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

                {/* BODY */}
                <div
                    className="
                        max-h-[75vh]
                        overflow-y-auto
                        bg-[#efefef]
                        p-3
                    "
                >

                    {/* TABLE HEADER */}
                    <div
                        className="
                            grid
                            grid-cols-[1fr_70px_90px]
                            border
                            border-[#cfcfcf]
                            bg-[#c8e3ef]
                            text-[12px]
                            font-bold
                        "
                    >

                        <div
                            className="
                                border-r
                                border-[#cfcfcf]
                                px-2
                                py-1
                                text-center
                            "
                        >
                            Module/Sub Module
                        </div>

                        <div
                            className="
                                border-r
                                border-[#cfcfcf]
                                px-2
                                py-1
                                text-center
                            "
                        >
                            View
                        </div>

                        <div
                            className="
                                px-2
                                py-1
                                text-center
                            "
                        >
                            Add/Edit
                        </div>

                    </div>

                    {/* TABLE BODY */}
                    <div
                        className="
                            border
                            border-t-0
                            border-[#cfcfcf]
                            bg-white
                        "
                    >

                        {sidebarConfig.map((module, moduleIndex) => (

                            <div key={module.title}>

                                {/* MAIN MODULE */}
                                <div
                                    className="
                                        border-b
                                        border-[#cfcfcf]
                                        bg-[#c8e3ef]
                                        px-2
                                        py-1
                                        text-[12px]
                                        font-bold
                                    "
                                >
                                    {moduleIndex + 1}. {module.title}
                                </div>

                                {/* CHILDREN */}
                                {module.children?.map((child, childIndex) => (

                                    <div key={child.title}>

                                        {/* SUB MODULE */}
                                        {child.children ? (

                                            <>
                                                {/* SECTION */}
                                                <div
                                                    className="
                                                        border-b
                                                        border-[#cfcfcf]
                                                        bg-[#d7ebcd]
                                                        px-2
                                                        py-1
                                                        text-[12px]
                                                        font-semibold
                                                    "
                                                >
                                                    {moduleIndex + 1}.
                                                    {childIndex + 1}{" "}
                                                    {child.title}
                                                </div>

                                                {/* SUB CHILDREN */}
                                                {child.children.map(
                                                    (sub, subIndex) => (

                                                        <div
                                                            key={sub.path}
                                                            className="
                                                                grid
                                                                grid-cols-[1fr_70px_90px]
                                                                border-b
                                                                border-[#cfcfcf]
                                                                text-[12px]
                                                            "
                                                        >

                                                            {/* NAME */}
                                                            <div
                                                                className="
                                                                    border-r
                                                                    border-[#cfcfcf]
                                                                    px-2
                                                                    py-1
                                                                "
                                                            >
                                                                {moduleIndex + 1}.
                                                                {childIndex + 1}.
                                                                {subIndex + 1}{" "}
                                                                {sub.title}
                                                            </div>

                                                            {/* VIEW */}
                                                            <div
                                                                className="
                                                                    flex
                                                                    items-center
                                                                    justify-center
                                                                    border-r
                                                                    border-[#cfcfcf]
                                                                "
                                                            >

                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        permissions?.[
                                                                            sub.path
                                                                            ]?.view || false
                                                                    }
                                                                    onChange={(e) =>
                                                                        handleCheckbox(
                                                                            sub.path,
                                                                            "view",
                                                                            e.target.checked
                                                                        )
                                                                    }
                                                                    className="
                                                                        h-3.5
                                                                        w-3.5
                                                                        cursor-pointer
                                                                    "
                                                                />

                                                            </div>

                                                            {/* EDIT */}
                                                            <div
                                                                className="
                                                                    flex
                                                                    items-center
                                                                    justify-center
                                                                "
                                                            >

                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        permissions?.[
                                                                            sub.path
                                                                            ]?.edit || false
                                                                    }
                                                                    onChange={(e) =>
                                                                        handleCheckbox(
                                                                            sub.path,
                                                                            "edit",
                                                                            e.target.checked
                                                                        )
                                                                    }
                                                                    className="
                                                                        h-3.5
                                                                        w-3.5
                                                                        cursor-pointer
                                                                    "
                                                                />

                                                            </div>

                                                        </div>
                                                    )
                                                )}

                                            </>

                                        ) : (

                                            <div
                                                className="
                                                    grid
                                                    grid-cols-[1fr_70px_90px]
                                                    border-b
                                                    border-[#cfcfcf]
                                                    text-[12px]
                                                "
                                            >

                                                {/* NAME */}
                                                <div
                                                    className="
                                                        border-r
                                                        border-[#cfcfcf]
                                                        px-2
                                                        py-1
                                                    "
                                                >
                                                    {moduleIndex + 1}.
                                                    {childIndex + 1}{" "}
                                                    {child.title}
                                                </div>

                                                {/* VIEW */}
                                                <div
                                                    className="
                                                        flex
                                                        items-center
                                                        justify-center
                                                        border-r
                                                        border-[#cfcfcf]
                                                    "
                                                >

                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            permissions?.[
                                                                child.path
                                                                ]?.view || false
                                                        }
                                                        onChange={(e) =>
                                                            handleCheckbox(
                                                                child.path,
                                                                "view",
                                                                e.target.checked
                                                            )
                                                        }
                                                        className="
                                                            h-3.5
                                                            w-3.5
                                                            cursor-pointer
                                                        "
                                                    />

                                                </div>

                                                {/* EDIT */}
                                                <div
                                                    className="
                                                        flex
                                                        items-center
                                                        justify-center
                                                    "
                                                >

                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            permissions?.[
                                                                child.path
                                                                ]?.edit || false
                                                        }
                                                        onChange={(e) =>
                                                            handleCheckbox(
                                                                child.path,
                                                                "edit",
                                                                e.target.checked
                                                            )
                                                        }
                                                        className="
                                                            h-3.5
                                                            w-3.5
                                                            cursor-pointer
                                                        "
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

                {/* FOOTER */}
                <div
                    className="
                        flex
                        justify-end
                        gap-2
                        border-t
                        border-[#cfcfcf]
                        bg-white
                        px-3
                        py-2
                    "
                >

                    {/* CANCEL */}
                    <button
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

                    {/* SAVE */}
                    <button
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