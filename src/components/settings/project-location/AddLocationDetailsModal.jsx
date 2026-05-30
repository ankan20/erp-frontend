"use client";

import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function AddLocationDetailsModal({
                                                    open,
                                                    onOpenChange,
                                                    newLocation,
                                                    setNewLocation,
                                                    onSave,
                                                    loading,
                                                    isEdit,
                                                }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-2xl p-8">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        {isEdit ? "Edit Location Details" : "Add Location Details"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    <h3><b>Add Store Location</b></h3>
                    <Input
                        placeholder="Store Location"
                        value={newLocation.storeLocation}
                        onChange={(e) =>
                            setNewLocation((prev) => ({
                                ...prev,
                                storeLocation: e.target.value,
                            }))
                        }
                        className="h-12"
                    />

                    <h3><b>Add User Location</b></h3>
                    <Input
                        placeholder="User Location"
                        value={newLocation.useLocation}
                        onChange={(e) =>
                            setNewLocation((prev) => ({
                                ...prev,
                                useLocation: e.target.value,
                            }))
                        }
                        className="h-12"
                    />

                    <button
                        type="button"
                        disabled={loading}
                        onClick={onSave}
                        className="bg-[#f7b183] hover:bg-[#f59b5f] border border-orange-500 text-black font-semibold px-16 py-3 rounded-md disabled:opacity-60"
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}