"use client";

export default function CreatorUsersPopup({
                                              open,
                                              onClose,
                                              users = [],
                                          }) {

    if (!open) return null;

    return (

        <div
            className="
                fixed inset-0 z-50
                flex items-center justify-center
                bg-black/40
            "
        >

            <div
                className="
                    w-[380px]
                    rounded-lg
                    bg-white
                    shadow-xl
                    overflow-hidden
                "
            >

                {/* HEADER */}

                <div
                    className="
                        flex items-center justify-between
                        border-b
                        px-4 py-3
                        bg-slate-100
                    "
                >

                    <h2
                        className="
                            text-base
                            font-bold
                        "
                    >
                        Creator Users
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="
                            text-lg
                            font-bold
                            px-2
                            rounded
                            hover:bg-slate-200
                        "
                    >
                        ×
                    </button>

                </div>

                {/* BODY */}

                <div
                    className="
                        max-h-[320px]
                        overflow-y-auto
                        p-4
                        space-y-2
                    "
                >

                    {users.length > 0 ? (

                        users.map((user) => (

                            <div
                                key={user.id}

                                className="
                                    border
                                    rounded-md
                                    px-3 py-2
                                    bg-gray-50
                                    text-sm
                                "
                            >

                                {user.userName ||
                                    user.userDisplayName ||
                                    "Unknown User"}

                            </div>
                        ))

                    ) : (

                        <div
                            className="
                                text-sm
                                text-gray-500
                            "
                        >
                            No users found
                        </div>
                    )}

                </div>

            </div>

        </div>
    );
}