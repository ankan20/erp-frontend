"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { Search, Trash2, Link2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useRouter } from "next/navigation";
import { getPageActions } from "@/components/common/PageActionButtons";
import MapUserModal from "@/components/common/MapUserModal";

import AddLocationModal from "@/components/settings/project-location/AddLocationModal";

import { sidebarConfig } from "@/config/sidebar.config";

export default function ProjectRolePage() {
  const [projectCode, setProjectCode] = useState("");
  const [projectData, setProjectData] = useState(null);
  const [users, setUsers] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [loadingModal, setLoadingModal] = useState(false);

  const [siteTeam, setSiteTeam] = useState([]);
  const [hoTeam, setHoTeam] = useState([]);
  const [tempPermissions, setTempPermissions] = useState({});

  const [openModal, setOpenModal] = useState(false);
  const [newDesignation, setNewDesignation] = useState({
    designationName: "",
    teamId: "",
  });
  const router = useRouter();
  const [openMapModal, setOpenMapModal] = useState(false);

  const [permissions, setPermissions] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState(false);

  const [openLocationModal, setOpenLocationModal] = useState(false);

  const inputClass =
    "h-[30px] border border-[#8f8f8f] text-sm bg-white rounded-sm";

  const labelClass =
    "w-[250px] px-3 py-1 bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm";

  //  FETCH USERS
  useEffect(() => {
    const fetchUsers = async () => {
      const res = await apiRequest({
        url: API_ENDPOINTS.SETTINGS.GET_ALL_USERS,
        method: "GET",
      });
      setUsers(res.data || []);
    };
    fetchUsers();
  }, []);

  //  SEARCH PROJECT
  const handleSearch = async () => {
    if (!projectCode) {
      toast.warning("Enter project code");
      return;
    }

    try {
      // setLoading(true);

      const res = await apiRequest({
        url: `${API_ENDPOINTS.SETTINGS.UPDATE_PROJECT_ROLES}/${projectCode}`,
        method: "GET",
      });

      const data = res.data[0];

      setProjectData(data);
      setProjectId(data.projectId);

      // enable button
      setSearchSuccess(true);

      const grouped = {};

      data.roleUserMap.forEach((item) => {
        if (!grouped[item.teamId]) {
          grouped[item.teamId] = {
            teamName: item.teamName,
            list: [],
          };
        }

        grouped[item.teamId].list.push({
          id: item.id,
          designationId: item.designationId,
          designationName: item.designationName,
          userId: item.userId || "",
          teamId: item.teamId,

          // permissions
          permissions: item.permissions || {},
          userPermissions: item.userPermissions || {},
        });
      });

      const teams = Object.values(grouped);
      // setHoTeam(teams[0]?.list || []);
      // setSiteTeam(teams[1]?.list || []);
      setHoTeam(grouped[1]?.list || []);
      setSiteTeam(grouped[2]?.list || []);
    } catch (err) {
      toast.error("Project not found");
    } finally {
      // setLoading(false);
    }
  };

  //  HANDLE CHANGE
  const handleUserChange = (teamSetter, team, index, value) => {
    const updated = [...team];
    updated[index].userId = value;
    teamSetter(updated);
  };

  // Parse Permission
  const parsePermissions = (backendPermissions) => {
    const parsed = {};

    // ALL MODULE PATHS FROM SIDEBAR
    const allPaths = [];

    sidebarConfig.forEach((module) => {
      module.children?.forEach((child) => {
        if (child.path) {
          allPaths.push(child.path);
        }

        child.children?.forEach((sub) => {
          if (sub.path) {
            allPaths.push(sub.path);
          }
        });
      });
    });

    Object.entries(backendPermissions || {}).forEach(([key, value]) => {
      if (!value) return;

      // company_details.VIEW
      const [moduleKey, action] = key.split(".");

      // convert company_details -> company-details
      const frontendKey = moduleKey.replaceAll("_", "-");

      // FIND MATCHING SIDEBAR PATH
      const matchedPath = allPaths.find((path) => path.includes(frontendKey));

      if (!matchedPath) return;

      if (!parsed[matchedPath]) {
        parsed[matchedPath] = {
          view: false,
          edit: false,
        };
      }

      if (action === "VIEW") {
        parsed[matchedPath].view = true;
      }

      if (action === "EDIT") {
        parsed[matchedPath].edit = true;
      }
    });

    return parsed;
  };

  // Formatting Permission
  const formatPermissions = (permissions) => {
    const formatted = {};

    Object.entries(permissions).forEach(([path, value]) => {
      const moduleName = path
        .split("/")
        .filter(Boolean)
        .pop()
        .replaceAll("-", "_");

      // ALWAYS SEND BOTH

      formatted[`${moduleName}.VIEW`] = value.view || false;

      formatted[`${moduleName}.EDIT`] = value.edit || false;
    });

    return formatted;
  };

  // HANDLE MAP USER
  const handleMapUser = (item) => {
    setSelectedRole(item);

    // PRIORITY:
    // 1. tempPermissions
    // 2. existing backend permissions

    const currentPermissions =
      tempPermissions[item.id] || item.permissions || {};

    setPermissions(parsePermissions(currentPermissions));

    setOpenMapModal(true);
  };

  // DELETE
  const handleDeleteDesignation = async () => {
    if (!deleteItem) return;

    let toastId;

    try {
      setDeleteLoading(true);

      toastId = toast.loading("Deleting...");

      await apiRequest({
        url: API_ENDPOINTS.SETTINGS.DELETE_ROLE,
        method: "DELETE",
        data: {
          ProjectId: projectId,
          TeamId: deleteItem.teamId,
          DesignationId: deleteItem.designationId,
        },
      });

      toast.success("Designation deleted successfully", {
        id: toastId,
      });

      setDeleteItem(null);

      // REFRESH DATA
      handleSearch();
    } catch (err) {
      toast.error(err.message || "Failed to delete designation", {
        id: toastId,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // handle Permissions
  const handlePermissionSave = async () => {
    const formattedPermissions = formatPermissions(permissions);

    // SAVE TEMPORARY IN FRONTEND
    setTempPermissions((prev) => ({
      ...prev,

      [selectedRole.id]: formattedPermissions,
    }));

    // UPDATE UI DATA ALSO
    setSiteTeam((prev) =>
      prev.map((item) =>
        item.id === selectedRole.id
          ? {
              ...item,
              permissions: formattedPermissions,
            }
          : item,
      ),
    );

    setHoTeam((prev) =>
      prev.map((item) =>
        item.id === selectedRole.id
          ? {
              ...item,
              permissions: formattedPermissions,
            }
          : item,
      ),
    );

    setOpenMapModal(false);
  };

  //  SAVE
  const handleSave = async () => {
    let toastId;

    try {
      toastId = toast.loading("Saving...");
      setLoading(true);
      const payload = {
        projectCode,

        roleUserMap: [
          ...siteTeam.map((r) => ({
            designationId: r.designationId,

            userId: Number(r.userId) || null,

            teamId: r.teamId,

            permissions: tempPermissions[r.id] || r.permissions || {},

            userPermissions: {},
          })),

          ...hoTeam.map((r) => ({
            designationId: r.designationId,

            userId: Number(r.userId) || null,

            teamId: r.teamId,

            permissions: tempPermissions[r.id] || r.permissions || {},

            userPermissions: {},
          })),
        ],
      };

      await apiRequest({
        url: `${API_ENDPOINTS.SETTINGS.UPDATE_PROJECT_ROLES}/${projectCode}`,
        method: "PUT",
        data: payload,
      });

      toast.success("Saved successfully", { id: toastId });
      setIsEditing(false);
      setLoading(false);
    } catch (err) {
      toast.error("Failed", { id: toastId });
      setLoading(false);
    }
  };

  //  ADD DESIGNATION
  const handleAddDesignation = async () => {
    if (!projectData) {
      toast.warning("Search project first");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Adding...");
      setLoadingModal(true);

      let res = await apiRequest({
        url: API_ENDPOINTS.SETTINGS.ADD_DESIGNATION,
        method: "POST",
        data: {
          ...newDesignation,
          projectId,
        },
      });

      toast.success("Added", { id: toastId });
      setOpenModal(false);
      setLoadingModal(false);
      handleSearch();
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
      setLoadingModal(false);
    }
  };

  // RENDER
  const renderTeam = (team, setTeam) => (
    <div className="space-y-2">
      {team.map((item, index) => (
        <div key={item.id} className="md:flex md:items-center md:gap-2">
          {/* DESIGNATION */}
          <div className="px-3 py-1 bg-[#e6d2c1] border text-sm min-w-62.5 rounded-sm">
            {item.designationName}
          </div>

          {/* USER SELECT */}
          <select
            value={item.userId || ""}
            disabled={!isEditing}
            onChange={(e) =>
              handleUserChange(setTeam, team, index, e.target.value)
            }
            className="border h-7.5 px-2 min-w-45 rounded-sm"
          >
            <option value="">Select User</option>

            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.loginUserName}
              </option>
            ))}
          </select>

          {/* ACTION BUTTONS */}
          {isEditing && (
            <div className="flex gap-2 mt-1 md:mt-0">
              {/* MAP BUTTON */}
              <button
                type="button"
                onClick={() => handleMapUser(item)}
                className="border rounded-sm p-1 hover:bg-blue-100 transition"
              >
                <Link2 size={16} />
              </button>

              {/* DELETE BUTTON */}
              <button
                type="button"
                // onClick={() => handleDeleteDesignation(item)}
                onClick={() => setDeleteItem(item)}
                className="border rounded-sm p-1 hover:bg-red-100 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const actions = getPageActions({
    router,
  });

  return (
    <>
      <PageHeader actions={actions} />

      <div className="p-4 space-y-2">
        {/* TOP ROW */}
        <div className="md:flex md:justify-between">
          <div className="md:flex gap-2 md:items-center">
            <div className="px-3 py-1 bg-[#d6e6f2] border rounded-sm md:min-w-[250px]">
              Project Code
            </div>

            <Input
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              disabled={isEditing}
              className={`w-[200px] ${inputClass}`}
            />

            <button onClick={handleSearch}>
              <Search size={18} />
            </button>
          </div>

          <div className="flex gap-2">
            <button
                onClick={() => {
                  if (!projectData) {
                    toast.warning("Search project first");
                    return;
                  }
                  setOpenModal(true);
                }}
                className={`px-5 py-1 rounded-md text-black ${
                    searchSuccess
                        ? "bg-[#8ed1fc] hover:bg-[#74c4f5]"
                        : "bg-gray-400 cursor-not-allowed"
                }`}
            >
              + Add Designation
            </button>
            {/* ADD LOCATION */}
            <button
                disabled={!searchSuccess}
                onClick={() => setOpenLocationModal(true)}
                className={`px-5 py-1 rounded-md text-black ${
                    searchSuccess
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-gray-400 cursor-not-allowed"
                }`}
            >
              + Add Location
            </button>
          </div>

        </div>

        {/* AUTO FIELDS */}
        <div className="md:flex gap-2 md:items-center">
          <div className="px-3 py-1 bg-[#d6e6f2] border rounded-sm md:min-w-[250px]">
            Project Name
          </div>
          <Input
              value={projectData?.projectName || "[Auto]"}
              disabled
              className={`w-[50%] ${inputClass}`}
          />
        </div>

        <div className="md:flex gap-2 md:items-center">
          <div className="px-3 py-1 bg-[#d6e6f2] border rounded-sm md:min-w-[250px]">
            Client Name
          </div>
          <Input
              value={projectData?.clientName || "[Auto]"}
              disabled
              className={`w-[50%] ${inputClass}`}
          />
        </div>

        {/* TEAMS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mt-4 ">
          <div>
            <div className="font-semibold text-blue-600 mb-2">* Site Team</div>
            {renderTeam(siteTeam, setSiteTeam)}
          </div>

          <div>
            <div className="font-semibold text-blue-600 mb-2">* HO Team</div>
            {renderTeam(hoTeam, setHoTeam)}
          </div>
        </div>

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 mt-10">
          <SaveButton
            onClick={handleSave}
            disabled={!isEditing || loading}
            loading={loading}
          />

          <EditButton
            onClick={() => setIsEditing((p) => !p)}
            disabled={loading}
          >
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        </div>

        {/* MODAL */}
        <Dialog
          open={openModal}
          onOpenChange={(v) => !loadingModal && setOpenModal(v)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Designation</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                placeholder="Designation Name"
                value={newDesignation.designationName}
                onChange={(e) =>
                  setNewDesignation((p) => ({
                    ...p,
                    designationName: e.target.value,
                  }))
                }
              />

              <select
                value={newDesignation.teamId}
                onChange={(e) =>
                  setNewDesignation((p) => ({
                    ...p,
                    teamId: Number(e.target.value),
                  }))
                }
                className="border w-full p-2"
              >
                <option value="">Select Team</option>
                <option value={"2"}>Site</option>
                <option value={"1"}>HO</option>
              </select>

              <Input value={projectCode} disabled />

              <SaveButton
                onClick={handleAddDesignation}
                loading={loadingModal}
                disabled={loadingModal}
              />
            </div>
          </DialogContent>
        </Dialog>

        <MapUserModal
          open={openMapModal}
          onOpenChange={setOpenMapModal}
          permissions={permissions}
          setPermissions={setPermissions}
          loading={loading}
          onSave={handlePermissionSave}
        />
      </div>
      <Dialog
        open={!!deleteItem}
        onOpenChange={(v) => {
          if (!deleteLoading && !v) {
            setDeleteItem(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Designation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-black">
                {deleteItem?.designationName}
              </span>
              ?
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeleteItem(null)}
                className="border px-4 py-2 rounded-md text-sm"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteDesignation}
                className="bg-red-500 text-white px-4 py-2 rounded-md text-sm hover:bg-red-600"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AddLocationModal
          open={openLocationModal}
          onOpenChange={setOpenLocationModal}
          projectCode={projectCode}
          projectData={projectData}
      />
    </>
  );
}
