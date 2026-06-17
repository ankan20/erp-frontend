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
import { Search, Trash2, Link2, Loader2 } from "lucide-react";
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
  const [searching, setSearching] = useState(false);

  const [openLocationModal, setOpenLocationModal] = useState(false);

  const [backupData, setBackupData] = useState(null);

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
      setSearching(true);

      const res = await apiRequest({
        url: `${API_ENDPOINTS.SETTINGS.UPDATE_PROJECT_ROLES}/${projectCode}`,
        method: "GET",
      });

      if (!res.data?.length) {
        setProjectData(null);
        setSiteTeam([]);
        setHoTeam([]);
        setSearchSuccess(false);
        toast.error("Project not found");
        return;
      }

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
      setProjectData(null);
      setSiteTeam([]);
      setHoTeam([]);
      setSearchSuccess(false);
      toast.error("Project not found");
    } finally {
      setSearching(false);
    }
  };

  //  HANDLE CHANGE
  const handleUserChange = (teamSetter, team, index, value) => {
    const updated = [...team];
    updated[index].userId = value;
    teamSetter(updated);
  };

  // Parse Permission
  const parsePermissions = (backendPermissions = {}) => {
    const parsed = {};

    Object.entries(backendPermissions).forEach(([key, value]) => {
      if (!value) return;

      const [permissionKey, action] = key.split(".");

      if (!parsed[permissionKey]) {
        parsed[permissionKey] = {
          view: false,
          edit: false,
        };
      }

      if (action === "VIEW") parsed[permissionKey].view = true;
      if (action === "EDIT") parsed[permissionKey].edit = true;
    });

    return parsed;
  };

  // Formatting Permission
  const formatPermissions = (permissions = {}) => {
    const formatted = {};

    Object.entries(permissions).forEach(([permissionKey, value]) => {
      formatted[`${permissionKey}.VIEW`] = value.view || false;
      formatted[`${permissionKey}.EDIT`] = value.edit || false;
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

  // handle undefined
  const cleanPermissions = (permissions = {}) => {
    const cleaned = {};

    Object.entries(permissions).forEach(([key, value]) => {
      if (!key || key === "undefined") return;

      cleaned[key] = {
        view: value.view || false,
        edit: value.edit || false,
      };
    });

    return cleaned;
  };

  // REMOVE PARENT ACCESS
// WHEN CHILD ACCESS IS ENABLED
  const removeParentAccessWhenChildrenEnabled = (
      permissions = {}
  ) => {

    const updated = { ...permissions };

    sidebarConfig.forEach((module) => {

      module.children?.forEach((child) => {

        child.children?.forEach((sub) => {

          // TRUE => REMOVE PARENT
          if (
              sub.children?.length > 0 &&
              sub.showChildrenInPermission === true
          ) {

            const parentAccessKey =
                sub.permissionKey ||
                sub.children?.find(
                    (item) => item.permissionKey
                )?.permissionKey;

            if (parentAccessKey) {
              delete updated[parentAccessKey];
            }
          }
        });
      });
    });

    return updated;
  };

// REMOVE CHILD ACCESS
// WHEN PARENT ACCESS IS ENABLED
  const removeChildAccessWhenParentEnabled = (
      permissions = {}
  ) => {

    const updated = { ...permissions };

    sidebarConfig.forEach((module) => {

      module.children?.forEach((child) => {

        child.children?.forEach((sub) => {

          // FALSE => REMOVE CHILDREN
          if (
              sub.children?.length > 0 &&
              sub.showChildrenInPermission === false
          ) {
            // Effective key used for the parent row (same logic as renderPermissionTree)
            const parentKey =
                sub.permissionKey ||
                sub.children?.find((c) => c.permissionKey)?.permissionKey;

            sub.children.forEach((inner) => {

              const childAccessKey =
                  inner.permissionAccessKey ||
                  inner.permissionKey;

              // Only delete if child key is different from the parent row key
              if (childAccessKey && childAccessKey !== parentKey) {
                delete updated[childAccessKey];
              }
            });
          }
        });
      });
    });

    return updated;
  };

  // handle Permissions
  const handlePermissionSave = async () => {
    // CLEAN INVALID VALUES
    const cleanedPermissions =
        cleanPermissions(permissions);

// REMOVE PARENT ACCESS
// IF CHILD ACCESS MODE ENABLED
    let finalPermissions =
        removeParentAccessWhenChildrenEnabled(
            cleanedPermissions
        );

// REMOVE CHILD ACCESS
// IF PARENT ACCESS MODE ENABLED
    finalPermissions =
        removeChildAccessWhenParentEnabled(
            finalPermissions
        );

// FORMAT FOR BACKEND
    const formattedPermissions =
        formatPermissions(finalPermissions);

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
            <div key={item.id} className="flex flex-wrap items-center gap-2">
              {/* DESIGNATION */}
              <div className="px-3 py-1 bg-[#e6d2c1] border text-sm rounded-sm w-[180px] shrink-0">
                {item.designationName}
              </div>

              {/* USER SELECT */}
              <select
                  value={item.userId || ""}
                  disabled={!isEditing || loading}
                  onChange={(e) =>
                      handleUserChange(setTeam, team, index, e.target.value)
                  }
                  className="border h-[30px] px-2 rounded-sm flex-1 min-w-[160px] max-w-[220px] text-sm disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <div className="flex gap-2">
                    {/* MAP BUTTON */}
                    <button
                        type="button"
                        onClick={() => handleMapUser(item)}
                        disabled={loading}
                        className="border rounded-sm p-1 hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Link2 size={16} />
                    </button>

                    {/* DELETE BUTTON */}
                    <button
                        type="button"
                        onClick={() => setDeleteItem(item)}
                        disabled={loading}
                        className="border rounded-sm p-1 hover:bg-red-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1 bg-[#d6e6f2] border rounded-sm w-[180px] shrink-0">
                Project Code
              </div>

              <Input
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isEditing && !searching) handleSearch();
                  }}
                  disabled={isEditing || searching}
                  className={`w-[180px] ${inputClass}`}
              />

              <button onClick={handleSearch} disabled={searching} className="disabled:opacity-50">
                {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                  onClick={() => {
                    if (!projectData) {
                      toast.warning("Search project first");
                      return;
                    }
                    setOpenModal(true);
                  }}
                  className={`px-4 py-1 rounded-md text-sm text-black ${
                      searchSuccess
                          ? "bg-[#8ed1fc] hover:bg-[#74c4f5]"
                          : "bg-gray-400 cursor-not-allowed"
                  }`}
              >
                + Add Designation
              </button>
              <button
                  disabled={!searchSuccess}
                  onClick={() => setOpenLocationModal(true)}
                  className={`px-4 py-1 rounded-md text-sm text-black ${
                      searchSuccess
                          ? "bg-green-500 hover:bg-green-600"
                          : "bg-gray-400 cursor-not-allowed"
                  }`}
              >
                + Add Location
              </button>
            </div>
          </div>

          {/* RESULTS — fade + slide in when data arrives */}
          <div className={`space-y-2 transition-all duration-500 ease-out ${projectData ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>

            {/* AUTO FIELDS */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1 bg-[#d6e6f2] border rounded-sm w-[180px] shrink-0">
                Project Name
              </div>
              <Input
                  value={projectData?.projectName || "[Auto]"}
                  disabled
                  className={`flex-1 min-w-[180px] max-w-[400px] ${inputClass}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1 bg-[#d6e6f2] border rounded-sm w-[180px] shrink-0">
                Client Name
              </div>
              <Input
                  value={projectData?.clientName || "[Auto]"}
                  disabled
                  className={`flex-1 min-w-[180px] max-w-[400px] ${inputClass}`}
              />
            </div>

            {/* TEAMS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mt-4">
              <div>
                <div className="font-semibold text-blue-600 mb-2">* Site Team</div>
                {renderTeam(siteTeam, setSiteTeam)}
              </div>

              <div>
                <div className="font-semibold text-blue-600 mb-2">* HO Team</div>
                {renderTeam(hoTeam, setHoTeam)}
              </div>
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
                onClick={() => {
                  if (!projectData) {
                    toast.warning("Search project first");
                    return;
                  }

                  // EDIT START
                  if (!isEditing) {
                    setBackupData({
                      siteTeam: structuredClone(siteTeam),
                      hoTeam: structuredClone(hoTeam),
                      tempPermissions: structuredClone(tempPermissions),
                    });

                    setIsEditing(true);
                    return;
                  }

                  // CANCEL
                  setSiteTeam(backupData?.siteTeam || []);
                  setHoTeam(backupData?.hoTeam || []);
                  setTempPermissions(backupData?.tempPermissions || {});
                  setBackupData(null);
                  setIsEditing(false);
                }}
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