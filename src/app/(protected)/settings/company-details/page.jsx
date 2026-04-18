"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";

export default function CompanyDetailsPage() {
  const [isEditing, setIsEditing] = useState(false);

  const panRef = useRef(null);
  const gstRef = useRef(null);

  const [formData, setFormData] = useState({
    companyName: "",
    registeredAddress: "",
    corporateAddress: "",
    pan: "",
    gstn: "",
    state: "",
    gstType: "",
    contactPerson: "",
    contactNumber: "",
    whatsapp: "",
    email: "",
    stateCode: "",
  });

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    console.log("SAVE API CALL:", formData);
    setIsEditing(false);
  };

  const handleEdit = () => setIsEditing(true);

  // 🎯 Styles
  const inputClass =
    "h-[30px] border border-[#8f8f8f] rounded-none text-sm bg-white rounded-sm";

  const labelClass =
    "w-[250px] px-3 py-1 bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm";

  const activeLabelClass =
    "w-[250px] px-3 py-1 bg-[#6fd1e3] border border-[#2f8fa3] text-sm rounded-sm";

  return (
    <div className="p-4 space-y-3">

      {/* COMPANY NAME */}
      <div className="md:flex md:items-center">
        <div className={activeLabelClass}>Company Name</div>
        <Input
          disabled={!isEditing}
          value={formData.companyName}
          onChange={(e) => handleChange("companyName", e.target.value)}
          className={`${inputClass} flex-1 -ml-px`}
        />
      </div>
    
        <div className="flex flex-col gap-[2px]">
            {/* REGISTERED ADDRESS */}
      <div className="md:flex md:items-center">
        <div className={labelClass}>Registered Address</div>
        <Input
          disabled={!isEditing}
          value={formData.registeredAddress}
          onChange={(e) => handleChange("registeredAddress", e.target.value)}
          className={`${inputClass} flex-1 -ml-px`}
        />
      </div>

      {/* CORPORATE ADDRESS */}
      <div className="md:flex md:items-center">
        <div className={labelClass}>Corporate Address</div>
        <Input
          disabled={!isEditing}
          value={formData.corporateAddress}
          onChange={(e) => handleChange("corporateAddress", e.target.value)}
          className={`${inputClass} flex-1 -ml-px`}
        />
      </div>
        </div>
      
        <div className=" flex flex-col gap-[2px]">
            {/* PAN */}
      <div className="md:flex md:items-center ">
        <div className={labelClass}>PAN</div>

        <Input
          disabled={!isEditing}
          value={formData.pan}
          onChange={(e) => handleChange("pan", e.target.value)}
          className={`${inputClass} w-[260px] -ml-px`}
        />

        <button className="md:ml-4 px-3 min-w-3xs py-1 bg-[#8e7cc3] text-white border border-[#5f4aa3] text-sm rounded-sm">
          Attached PAN
        </button>

        <button
          onClick={() => panRef.current.click()}
          className="px-3 py-1 min-w-[80px] bg-[#f6c85f] border border-[#caa03f] text-sm rounded-sm cursor-pointer"
        >
          @
        </button>

        <input
          ref={panRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => console.log("PAN FILE:", e.target.files[0])}
        />
      </div>

      {/* GSTN */}
      <div className="md:flex md:items-center ">
        <div className={labelClass}>GSTN</div>

        <Input
          disabled={!isEditing}
          value={formData.gstn}
          onChange={(e) => handleChange("gstn", e.target.value)}
          className={`${inputClass} w-[260px] -ml-px`}
        />

        <button className="md:ml-4 px-3 min-w-3xs py-1  bg-[#8e7cc3] text-white border border-[#5f4aa3] text-sm rounded-sm">
          Attached GSTN
        </button>

        <button
          onClick={() => gstRef.current.click()}
          className="px-3 py-1 min-w-[80px] bg-[#f6c85f] border border-[#caa03f] text-sm rounded-sm cursor-pointer"
        >
          @
        </button>

        <input
          ref={gstRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => console.log("GST FILE:", e.target.files[0])}
        />
      </div>

      {/* STATE */}
      <div className="md:flex md:items-center ">
        <div className={labelClass}>State</div>

        <Input
          disabled={!isEditing}
          value={formData.state}
          onChange={(e) => handleChange("state", e.target.value)}
          className={`${inputClass} w-[260px] -ml-px`}
        />

        <div className={`${labelClass} md:ml-4`}>State Code</div>

        <Input
          disabled={!isEditing}
          value={formData.stateCode}
          onChange={(e) => handleChange("stateCode", e.target.value)}
          className={`${inputClass} w-[100px] -ml-px`}
        />
      </div>

      {/* GST TYPE */}
      <div className="md:flex md:items-center">
        <div className={labelClass}>GSTN Type</div>
        <Input
          disabled={!isEditing}
          value={formData.gstType}
          onChange={(e) => handleChange("gstType", e.target.value)}
          className={`${inputClass} w-[260px] -ml-px`}
        />
      </div>
        </div>
      

      {/* CONTACT */}
      <div className="space-y-0.5 pt-3">

        <div className="md:flex md:items-center">
          <div className={labelClass}>Contact Person</div>
          <Input
            disabled={!isEditing}
            value={formData.contactPerson}
            onChange={(e) =>
              handleChange("contactPerson", e.target.value)
            }
            className={`${inputClass} w-[260px] -ml-px`}
          />
        </div>

        <div className="md:flex md:items-center">
          <div className={labelClass}>Contact Number</div>
          <Input
            disabled={!isEditing}
            value={formData.contactNumber}
            onChange={(e) =>
              handleChange("contactNumber", e.target.value)
            }
            className={`${inputClass} w-[260px] -ml-px`}
          />
        </div>

        <div className="md:flex md:items-center">
          <div className={labelClass}>WhatsApp Number</div>
          <Input
            disabled={!isEditing}
            value={formData.whatsapp}
            onChange={(e) => handleChange("whatsapp", e.target.value)}
            className={`${inputClass} w-[260px] -ml-px`}
          />
        </div>

        <div className="md:flex md:items-center">
          <div className={labelClass}>Email ID</div>
          <Input
            disabled={!isEditing}
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className={`${inputClass} w-[260px] -ml-px`}
          />
        </div>

      </div>

      {/* ACTION BUTTONS */}
      <div className="flex justify-end gap-3 md:mt-24 mt-5">
        <SaveButton onClick={handleSave} />
        <EditButton onClick={handleEdit} />
      </div>
    </div>
  );
}