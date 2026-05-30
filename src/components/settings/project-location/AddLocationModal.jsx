"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

import AddLocationDetailsModal from "./AddLocationDetailsModal";

export default function AddLocationModal({
                                             open,
                                             onOpenChange,
                                             projectCode,
                                             projectData,
                                         }) {
    const [openDetailsModal, setOpenDetailsModal] = useState(false);
    const [locations, setLocations] = useState([]);
    const [locationLoading, setLocationLoading] = useState(false);
    const [savingLocation, setSavingLocation] = useState(false);
    const [editingLocation, setEditingLocation] = useState(null);

    const [newLocation, setNewLocation] = useState({
        storeLocation: "",
        useLocation: "",
    });

    const showValue = (value) => {
        if (value === null || value === undefined || value === "") {
            return "_____";
        }

        return value;
    };

    const fetchLocations = async () => {
        if (!projectCode) return;

        try {
            setLocationLoading(true);

            const res = await apiRequest({
                url: `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION}/${projectCode}`,
                method: "GET",
            });

            setLocations(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.log("GET location failed:", err);

            setLocations([]);

            if (
                err?.response?.status === 404 ||
                err?.message?.includes("not found")
            ) {
                return;
            }

            toast.error(
                err?.response?.data?.message ||
                err.message ||
                "Failed to fetch locations"
            );
        } finally {
            setLocationLoading(false);
        }
    };

    useEffect(() => {
        if (open && projectCode) {
            fetchLocations();
        }
    }, [open, projectCode]);

    const handleOpenAdd = () => {
        setEditingLocation(null);

        setNewLocation({
            storeLocation: "",
            useLocation: "",
        });

        setOpenDetailsModal(true);
    };

    const handleEditClick = (location) => {
        setEditingLocation(location);

        setNewLocation({
            storeLocation: location.storeLocation || "",
            useLocation: location.useLocation || "",
        });

        setOpenDetailsModal(true);
    };

    const handleSaveLocation = async () => {
        if (!newLocation.storeLocation && !newLocation.useLocation) {
            toast.warning("Fill location details");
            return;
        }

        let toastId;

        try {
            setSavingLocation(true);

            toastId = toast.loading(editingLocation ? "Updating..." : "Saving...");

            if (editingLocation) {
                await apiRequest({
                    url: `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION}/${editingLocation.id}`,
                    method: "PUT",
                    data: {
                        storeLocation: newLocation.storeLocation || null,
                        useLocation: newLocation.useLocation || null,
                    },
                });

                toast.success("Location updated", { id: toastId });
            } else {
                await apiRequest({
                    url: API_ENDPOINTS.SETTINGS.PROJECT_LOCATION,
                    method: "POST",
                    data: {
                        projectCode: projectCode,
                        storeLocation: newLocation.storeLocation || null,
                        useLocation: newLocation.useLocation || null,
                    },
                });

                toast.success("Location created", { id: toastId });
            }

            setOpenDetailsModal(false);
            setEditingLocation(null);

            setNewLocation({
                storeLocation: "",
                useLocation: "",
            });

            fetchLocations();
        } catch (err) {
            toast.error(
                err?.response?.data?.message ||
                err.message ||
                "Failed to save location",
                { id: toastId }
            );
        } finally {
            setSavingLocation(false);
        }
    };

    const handleDeleteLocation = async (location) => {
        let toastId;

        try {
            toastId = toast.loading("Deleting...");

            await apiRequest({
                url: `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION}/${location.id}`,
                method: "DELETE",
            });

            toast.success("Location deleted successfully", {
                id: toastId,
            });

            setLocations((prev) =>
                prev.filter((item) => item.id !== location.id)
            );
        } catch (err) {
            toast.error(
                err?.response?.data?.message ||
                err.message ||
                "Failed to delete location",
                { id: toastId }
            );
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="
                        !max-w-none
                        !w-auto
                        !p-0
                        border-0
                        bg-transparent
                        shadow-none
                    "
                >
                    <div
                        className="
                            w-[92vw]
                            max-w-[1400px]
                            h-[88vh]
                            bg-white
                            rounded-xl
                            shadow-xl
                            p-6
                            flex
                            flex-col
                            overflow-y-auto
                        "
                    >
                        <DialogHeader>
                            <DialogTitle
                                className="
                                    text-3xl
                                    font-bold
                                "
                            >
                                Add Location
                            </DialogTitle>
                        </DialogHeader>

                        <div
                            className="
                                space-y-4
                                mt-5
                            "
                        >
                            {/* Project Code + Location Button */}

                            <div
                                className="
                                    grid
                                    grid-cols-[280px_1fr_auto]
                                    gap-4
                                    items-center
                                "
                            >
                                <div
                                    className="
                                        px-4
                                        py-3
                                        bg-[#d6e6f2]
                                        border
                                        rounded-sm
                                        font-semibold
                                        text-base
                                    "
                                >
                                    Project Code
                                </div>

                                <Input
                                    value={showValue(projectCode)}
                                    disabled
                                    className="
                                        h-10
                                        text-base
                                    "
                                />

                                <button
                                    type="button"
                                    onClick={handleOpenAdd}
                                    className="
                                        bg-green-500
                                        hover:bg-green-600
                                        text-black
                                        px-5
                                        h-10
                                        rounded-md
                                        font-semibold
                                        shadow
                                        whitespace-nowrap
                                    "
                                >
                                    + Location
                                </button>
                            </div>

                            {/* Project Name */}

                            <div
                                className="
                                    grid
                                    grid-cols-[280px_1fr_auto]
                                    gap-4
                                    items-center
                                "
                            >
                                <div
                                    className="
                                        px-4
                                        py-3
                                        bg-[#d6e6f2]
                                        border
                                        rounded-sm
                                        font-semibold
                                        text-base
                                    "
                                >
                                    Project Name
                                </div>

                                <Input
                                    value={showValue(projectData?.projectName)}
                                    disabled
                                    className="
                                        h-10
                                        text-base
                                    "
                                />

                                <div className="w-[118px]" />
                            </div>

                            {/* Client Name */}

                            <div
                                className="
                                    grid
                                    grid-cols-[280px_1fr_auto]
                                    gap-4
                                    items-center
                                "
                            >
                                <div
                                    className="
                                        px-4
                                        py-3
                                        bg-[#d6e6f2]
                                        border
                                        rounded-sm
                                        font-semibold
                                        text-base
                                    "
                                >
                                    Client Name
                                </div>

                                <Input
                                    value={showValue(projectData?.clientName)}
                                    disabled
                                    className="
                                        h-10
                                        text-base
                                    "
                                />

                                <div className="w-[118px]" />
                            </div>
                        </div>

                        {/* Table Section */}

                        <div
                            className="
                                border
                                rounded-md
                                mt-6
                                overflow-hidden
                                min-h-[360px]
                                flex
                                flex-col
                            "
                        >
                            <div
                                className="
                                    grid
                                    grid-cols-[1fr_1fr_140px]
                                    bg-[#e6d2c1]
                                    font-semibold
                                    border-b
                                "
                            >
                                <div
                                    className="
                                        px-5
                                        py-3
                                        text-base
                                        border-r
                                    "
                                >
                                    Store Location
                                </div>

                                <div
                                    className="
                                        px-5
                                        py-3
                                        text-base
                                        border-r
                                    "
                                >
                                    User Location
                                </div>

                                <div
                                    className="
                                        px-5
                                        py-3
                                        text-base
                                        text-center
                                    "
                                >
                                    Action
                                </div>
                            </div>

                            <div
                                className="
                                    flex-1
                                    overflow-y-auto
                                    bg-white
                                "
                            >
                                {locationLoading ? (
                                    <div
                                        className="
                                            h-full
                                            min-h-[320px]
                                            flex
                                            items-center
                                            justify-center
                                            text-gray-500
                                            text-lg
                                        "
                                    >
                                        Loading locations...
                                    </div>
                                ) : locations.length === 0 ? (
                                    <div
                                        className="
                                            h-full
                                            min-h-[320px]
                                            flex
                                            items-center
                                            justify-center
                                            text-gray-500
                                            text-lg
                                        "
                                    >
                                        No locations added yet.
                                    </div>
                                ) : (
                                    locations.map((location) => (
                                        <div
                                            key={location.id}
                                            className="
                                                grid
                                                grid-cols-[1fr_1fr_140px]
                                                border-b
                                                text-sm
                                            "
                                        >
                                            <div
                                                className="
                                                    px-5
                                                    py-3
                                                    border-r
                                                "
                                            >
                                                {showValue(location.storeLocation)}
                                            </div>

                                            <div
                                                className="
                                                    px-5
                                                    py-3
                                                    border-r
                                                "
                                            >
                                                {showValue(location.useLocation)}
                                            </div>

                                            <div
                                                className="
                                                    px-5
                                                    py-2
                                                    flex
                                                    justify-center
                                                    gap-2
                                                "
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleEditClick(location)
                                                    }
                                                    className="
                                                        border
                                                        rounded-sm
                                                        p-2
                                                        hover:bg-blue-100
                                                        transition
                                                    "
                                                >
                                                    <Pencil size={16} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleDeleteLocation(location)
                                                    }
                                                    className="
                                                        border
                                                        rounded-sm
                                                        p-2
                                                        hover:bg-red-100
                                                        transition
                                                    "
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AddLocationDetailsModal
                open={openDetailsModal}
                onOpenChange={setOpenDetailsModal}
                newLocation={newLocation}
                setNewLocation={setNewLocation}
                onSave={handleSaveLocation}
                loading={savingLocation}
                isEdit={!!editingLocation}
            />
        </>
    );
}