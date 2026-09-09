'use client';

import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

/**
 * One row in the picker.
 *
 * A view model rather than a `PostItem`, because the picker needs three fields
 * and the list endpoint returns a person, a community and a counts block per
 * post. The caller maps.
 */
export interface HireAgainPost {
    id: number;
    name: string;
    budget?: number;
}

interface HireAgainModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (postId: number) => void;
    posts: HireAgainPost[];
    isLoading: boolean;
    /**
     * The job to offer. Ignored unless it is one of `posts`: the room's
     * recorded post may belong to the other person, because roles swap between
     * orders, and the server would refuse an order started against it.
     */
    preselectedPostId: number | null;
    createJobHref: string;
}

/**
 * "Hire again" asks which job.
 *
 * It used to be a yes/no confirm that started a workflow against the room's
 * recorded post. One conversation now spans every job two people have run
 * together, so that value is whichever post the room last saw -- and for a
 * consolidated room it is null. A real order, holding real coins, must not be
 * started against a job nobody chose, so the choice is always shown, even when
 * one is offered.
 */
export const HireAgainModal: React.FC<HireAgainModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    posts,
    isLoading,
    preselectedPostId,
    createJobHref,
}) => {
    const {t} = useTranslation();
    const [picked, setPicked] = useState<number | null>(null);

    if (!isOpen) return null;

    const offered = posts.some(p => p.id === preselectedPostId) ? preselectedPostId : null;
    const chosen = picked ?? offered;

    const close = () => {
        setPicked(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 pt-10 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-[95%] sm:w-[90%] max-w-lg shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900">
                    {t('profileChat.ordersPickPost')}
                </h3>

                {isLoading ? (
                    <p className="mt-4 text-sm text-gray-500">{t('profileChat.ordersPickPostLoading')}</p>
                ) : posts.length === 0 ? (
                    <div className="mt-4">
                        <p className="text-sm text-gray-500">{t('profileChat.ordersNoPostsToHire')}</p>
                        <a
                            href={createJobHref}
                            className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                        >
                            {t('profileChat.ordersPostAJob')}
                        </a>
                    </div>
                ) : (
                    <ul className="mt-4 max-h-72 overflow-y-auto divide-y divide-gray-100">
                        {posts.map(post => (
                            <li key={post.id}>
                                <label className="flex cursor-pointer items-start gap-3 py-3">
                                    <input
                                        type="radio"
                                        name="hire-again-post"
                                        className="mt-1"
                                        value={String(post.id)}
                                        checked={chosen === post.id}
                                        onChange={() => setPicked(post.id)}
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-gray-900">
                                            {post.name}
                                        </span>
                                        {post.budget != null && (
                                            <span className="block text-xs text-gray-500">
                                                {t('profileChat.ordersPostBudget', {amount: post.budget})}
                                            </span>
                                        )}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={close}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
                    >
                        {t('profileChat.cancel')}
                    </button>
                    <button
                        type="button"
                        data-testid="hire-again-confirm"
                        disabled={chosen == null}
                        onClick={() => {
                            if (chosen == null) return;
                            setPicked(null);
                            onConfirm(chosen);
                        }}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {t('profileChat.ordersHireAgain')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HireAgainModal;
