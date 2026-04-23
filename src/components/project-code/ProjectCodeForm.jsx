"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const projectSchema = z.object({
    projectCode: z.string().min(1, "Required"),
    clientName: z.string().min(1, "Required"),
    gstn: z.string().min(1, "Required"),

    stateCode: z.string().optional(),
    state: z.string().optional(),

    registeredAddress: z.string().min(1, "Required"),
    projectName: z.string().min(1, "Required"),
    projectDetails: z.string().min(1, "Required"),

    projectManager: z.string().min(1, "Required"),
    projMgmtContactNumber: z
        .string()
        .regex(/^[0-9]{10}$/, "Invalid number"),
    projMgmtEmailId: z.string().email("Invalid email"),

    commercialManager: z.string().optional(),
    commMgmtContactNumber: z.string().optional(),
    commMgmtEmailId: z.string().optional(),

    initialOrderValue: z
        .string()
        .min(1, "Required")
        .regex(/^[0-9]+$/, "Only numbers"),

    revisedOrderValue: z.string().optional(),

    scheduleDate: z.string().min(1, "Required"),
    scheduleCompletionDate: z.string().min(1, "Required"),
    originalStartDate: z.string().optional(),
    extendedCompleteDate: z.string().optional(),

    billingAddress: z.string().min(1, "Required"),
    shippingAddress: z.string().optional(),
    shippingAddress2: z.string().optional(),
    shippingAddress3: z.string().optional(),

    status: z.string().min(1, "Required"),
});

export default function ProjectForm({ mode = "create", data ,projectId}) {
    const [isEditing, setIsEditing] = useState(mode === "create");

    const {
        register,
        handleSubmit,
        reset,
        getValues,
        formState: { isSubmitting, errors },
    } = useForm({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            projectCode: "",
            clientName: "",
            gstn: "",
            stateCode: "",
            state: "",
            registeredAddress: "",
            projectName: "",
            projectDetails: "",
            projectManager: "",
            projMgmtContactNumber: "",
            projMgmtEmailId: "",
            commercialManager: "",
            commMgmtContactNumber: "",
            commMgmtEmailId: "",
            initialOrderValue: "",
            revisedOrderValue: "",
            scheduleDate: "",
            scheduleCompletionDate: "",
            originalStartDate: "",
            extendedCompleteDate: "",
            billingAddress: "",
            shippingAddress: "",
            shippingAddress2: "",
            shippingAddress3: "",
            status: "",
        },
    });

    // LOAD DATA 
    useEffect(() => {
        if (data) {
            reset(data);
        }
    }, [data]);

    //  SUBMIT 
    const onSubmit = async () => {
        let toastId;

        try {
            const values = getValues();

            toastId = toast.loading(
                mode === "edit"
                    ? "Updating project..."
                    : "Saving project..."
            );

            await apiRequest({
                url:
                    mode === "create"
                        ? API_ENDPOINTS.SETTINGS.CREATE_PROJECT
                        : `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`,
                method: mode === "create" ? "POST" : "PUT",
                data: values,
            });

            toast.success(
                mode === "edit"
                    ? "Updated successfully"
                    : "Saved successfully",
                { id: toastId }
            );

            setIsEditing(false);
        } catch (err) {
            toast.error(err.message || "Failed", { id: toastId });
        }
    };

    //  EDIT TOGGLE 
    const handleEdit = () => {
        if (isEditing && mode === "edit") {
            reset(data);
        }
        setIsEditing((prev) => !prev);
    };

    //  STYLES 
    const inputClass =
        "h-[30px] border border-[#8f8f8f] text-sm bg-white rounded-sm w-full";

    const labelClass =
        "px-3 py-1 bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm min-w-[180px]";

    const getInputClass = (fieldError) =>
        `${inputClass} ${fieldError ? "border-red-500 focus:ring-red-400" : ""
        }`;

    // ================= UI =================
    return (
        <div className="p-4 space-y-2">

            {/* TOP ROW */}

            <div className="flex gap-4 flex-wrap">

                {/* PROJECT CODE */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                        <div className={labelClass}>Project Code</div>

                        <Input
                            {...register("projectCode")}
                            disabled={!isEditing || isSubmitting}
                            className={`w-[200px] ${getInputClass(errors.projectCode)}`}
                            placeholder="Text"
                        />
                    </div>

                    <p className="text-red-500 text-[10px] h-[14px]">
                        {errors.projectCode?.message}
                    </p>
                </div>

                {/* STATUS */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                        <div className={labelClass}>Status</div>

                        <select
                            {...register("status")}
                            disabled={!isEditing || isSubmitting}
                            className={`w-[200px] ${getInputClass(errors.status)} disabled:bg-gray-100 
    disabled:text-gray-500`}
                        >
                            <option value="">Select</option>
                            <option value="ongoing">Ongoing</option>
                            <option value="hold">Hold</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    <p className="text-red-500 text-[10px] h-[14px]">
                        {errors.status?.message}
                    </p>
                </div>

            </div>

            {/* CLIENT */}
            <div className="flex flex-col">

                <div className="flex flex-wrap gap-2">
                    <div className={labelClass}>Client Name</div>

                    <Input
                        {...register("clientName")}
                        disabled={!isEditing || isSubmitting}
                        className={`flex-1 ${getInputClass(errors.clientName)}`}
                        placeholder="Text"
                    />
                </div>

                {/* optional error message */}
                <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                    {errors.clientName?.message}
                </p>

            </div>

            <div className="flex flex-wrap gap-4">

                {/* GSTN */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                        <div className={labelClass}>GSTN</div>

                        <Input
                            {...register("gstn")}
                            disabled={!isEditing || isSubmitting}
                            className={`w-[200px] ${getInputClass(errors.gstn)}`}
                        />
                    </div>

                    <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                        {errors.gstn?.message}
                    </p>
                </div>

                {/* STATE CODE */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                        <div className={labelClass}>State Code</div>

                        <Input
                            {...register("stateCode")}
                            disabled={!isEditing || isSubmitting}
                            className={`w-[120px] ${getInputClass(errors.stateCode)}`}
                        />
                    </div>

                    <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                        {errors.stateCode?.message}
                    </p>
                </div>

                {/* STATE NAME */}
                <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-1">
                        <div className={labelClass}>State Name</div>

                        <Input
                            {...register("state")}
                            disabled={!isEditing || isSubmitting}
                            className={`flex-1 ${getInputClass(errors.state)}`}
                        />
                    </div>

                    <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                        {errors.state?.message}
                    </p>
                </div>

            </div>

            {/* ADDRESS */}
            <div className="flex flex-col">

                <div className="flex flex-wrap gap-2">
                    <div className={labelClass}>Registered Address</div>

                    <Input
                        {...register("registeredAddress")}
                        disabled={!isEditing || isSubmitting}
                        className={`flex-1 ${getInputClass(errors.registeredAddress)}`}
                        placeholder="Text"
                    />
                </div>

                <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                    {errors.registeredAddress?.message}
                </p>

            </div>

            {/* PROJECT DETAILS */}
            {/* PROJECT NAME */}
            <div className="flex flex-col">
                <div className="flex flex-wrap gap-2">
                    <div className={labelClass}>Project Name</div>

                    <Input
                        {...register("projectName")}
                        disabled={!isEditing || isSubmitting}
                        className={`flex-1 ${getInputClass(errors.projectName)}`}
                        placeholder="Text"
                    />
                </div>

                <p className="text-red-500 text-[10px] h-[14px]">
                    {errors.projectName?.message}
                </p>
            </div>

            {/* PROJECT DETAILS */}
            <div className="flex flex-col">
                <div className="flex flex-wrap gap-2">
                    <div className={labelClass}>Project Details</div>

                    <textarea
                        {...register("projectDetails")}
                        disabled={!isEditing || isSubmitting}
                        className={`border text-sm rounded-sm w-full p-2 ${errors.projectDetails ? "border-red-500" : "border-[#8f8f8f]"
                            } disabled:bg-gray-100 
    disabled:text-gray-500 
    `}
                        placeholder="Text"
                    />
                </div>

                <p className="text-red-500 text-[10px] h-[14px]">
                    {errors.projectDetails?.message}
                </p>
            </div>

            {/* MANAGERS */}
            <div className="grid md:grid-cols-2 gap-3">

                {/* PM */}
                <div className="space-y-2">

                    {/* NAME */}
                    <div className="flex flex-col">
                        <div className="flex gap-2">
                            <div className={labelClass}>Project Manager</div>

                            <Input
                                {...register("projectManager")}
                                disabled={!isEditing || isSubmitting}
                                className={getInputClass(errors.projectManager)}
                            />
                        </div>

                        <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.projectManager?.message}
                        </p>
                    </div>

                    {/* CONTACT */}
                    <div className="flex flex-col">
                        <div className="flex gap-2">
                            <div className={labelClass}>Contact Number</div>

                            <Input
                                {...register("projMgmtContactNumber")}
                                disabled={!isEditing || isSubmitting}
                                className={getInputClass(errors.projMgmtContactNumber)}
                            />
                        </div>

                        <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.projMgmtContactNumber?.message}
                        </p>
                    </div>

                    {/* EMAIL */}
                    <div className="flex flex-col">
                        <div className="flex gap-2">
                            <div className={labelClass}>Email Id</div>

                            <Input
                                {...register("projMgmtEmailId")}
                                disabled={!isEditing || isSubmitting}
                                className={getInputClass(errors.projMgmtEmailId)}
                            />
                        </div>

                        <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.projMgmtEmailId?.message}
                        </p>
                    </div>

                </div>

                {/* CM */}
                <div className="space-y-2">

                    <div className="flex flex-col">
                        <div className="flex gap-2">
                            <div className={labelClass}>Commercial Manager</div>

                            <Input
                                {...register("commercialManager")}
                                disabled={!isEditing || isSubmitting}
                                className={getInputClass(errors.commercialManager)}
                            />
                        </div>

                        <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.commercialManager?.message}
                        </p>
                    </div>

                    <div className="flex flex-col">
                        <div className="flex gap-2">
                            <div className={labelClass}>Contact Number</div>

                            <Input
                                {...register("commMgmtContactNumber")}
                                disabled={!isEditing || isSubmitting}
                                className={getInputClass(errors.commMgmtContactNumber)}
                            />
                        </div>

                        <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.commMgmtContactNumber?.message}
                        </p>
                    </div>

                    <div className="flex flex-col">
                        <div className="flex gap-2">
                            <div className={labelClass}>Email Id</div>

                            <Input
                                {...register("commMgmtEmailId")}
                                disabled={!isEditing || isSubmitting}
                                className={getInputClass(errors.commMgmtEmailId)}
                            />
                        </div>

                        <p className="text-red-500 text-[10px] h-[14px]">
                            {errors.commMgmtEmailId?.message}
                        </p>
                    </div>

                </div>
            </div>

            {/* VALUES */}
            <div className="grid md:grid-cols-2 gap-3">

                <div className="flex flex-col">
                    <div className="flex gap-2">
                        <div className={labelClass}>Initial Order Value</div>

                        <Input
                            {...register("initialOrderValue")}
                            disabled={!isEditing || isSubmitting}
                            className={getInputClass(errors.initialOrderValue)}
                        />
                    </div>

                    <p className="text-red-500 text-[10px] h-[14px]">
                        {errors.initialOrderValue?.message}
                    </p>
                </div>

                <div className="flex flex-col">
                    <div className="flex gap-2">
                        <div className={labelClass}>Revised Order Value</div>

                        <Input
                            {...register("revisedOrderValue")}
                            disabled={!isEditing || isSubmitting}
                            className={getInputClass(errors.revisedOrderValue)}
                        />
                    </div>

                    <p className="text-red-500 text-[10px] h-[14px]">
                        {errors.revisedOrderValue?.message}
                    </p>
                </div>

            </div>

            {/* DATES */}
            <div className="grid md:grid-cols-2 gap-3">

                {[
                    ["Schedule Start Date", "scheduleDate"],
                    ["Original Start Date", "originalStartDate"],
                    ["Schedule Completion Date", "scheduleCompletionDate"],
                    ["Extended Completion Date", "extendedCompleteDate"],
                ].map(([label, key]) => (
                    <div key={key} className="flex flex-col">

                        <div className="flex gap-2 items-center">
                            <div className={labelClass}>{label}</div>

                            <Input
                                type="date"
                                {...register(key)}
                                disabled={!isEditing || isSubmitting}
                                className={getInputClass(errors[key])}
                            />
                        </div>

                        <p className="text-red-500 text-[10px] h-[14px]">
                            {errors[key]?.message}
                        </p>

                    </div>
                ))}

            </div>

            {/* ADDRESS BLOCK */}
            {[
                ["BADD", "Billing Address", "billingAddress"],
                ["SHP1", "Shipping Address 1", "shippingAddress"],
                ["SHP2", "Shipping Address 2", "shippingAddress2"],
                ["SHP3", "Shipping Address 3", "shippingAddress3"],
            ].map(([short, full, key]) => (
                <div key={key} className="flex flex-col">

                    <div className="flex gap-2 items-center">

                        {/* SHORT LABEL */}
                        <div className={`${labelClass} min-w-[80px] text-center`}>
                            {short}
                        </div>

                        {/* FULL LABEL */}
                        <div className={`${labelClass} min-w-[180px]`}>
                            {full}
                        </div>

                        {/* INPUT */}
                        <Input
                            {...register(key)}
                            disabled={!isEditing || isSubmitting}
                            className={`flex-1 ${getInputClass(errors[key])}`}
                            placeholder="Text"
                        />
                    </div>

                    {/* ERROR */}
                    <p className="text-red-500 text-[10px] h-[14px] mt-[2px]">
                        {errors[key]?.message}
                    </p>

                </div>
            ))}

            {/* BUTTONS */}
            <div className="flex justify-end gap-3 mt-10">
                <SaveButton
                    onClick={() => handleSubmit(onSubmit)()}
                    loading={isSubmitting}
                    disabled={!isEditing || isSubmitting}
                />

                {mode === "edit" && (
                    <EditButton onClick={handleEdit}>
                        {isEditing ? "Cancel" : "Edit"}
                    </EditButton>
                )}
            </div>
        </div>
    );
}