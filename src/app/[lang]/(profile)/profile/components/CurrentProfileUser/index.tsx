"use client";
import React from "react";
import {Person} from "@108-plaza/jh-client";
import ProfileHero from "@/components/Profile/ProfileHero";
import AboutCard from "@/components/Profile/AboutCard";
import SkillsCard from "@/components/Profile/SkillsCard";
import ContactCard from "@/components/Profile/ContactCard";
import ResumeCard from "@/components/Profile/ResumeCard";
import WorkSamplesSlider from "@/components/Profile/WorkSamplesSlider";
import Reviews from "@/components/Profile/Reviews";
import NotFound from "@/components/Common/NotFound";
import {useUserStore} from "@/store/useUserStore";

interface ProfileProps {
    profile: Person | null;
}

const CurrentProfileUser: React.FC<ProfileProps> = ({profile}) => {
    const {person: currentUserProfile} = useUserStore();
    const isOwnProfile = currentUserProfile?.id === profile?.id;

    if (!profile) {
        return <NotFound/>;
    }

    const workSamples = profile.workSamples ?? [];

    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <ProfileHero profile={profile} isOwnProfile={isOwnProfile} currentUserId={currentUserProfile?.id}/>
                <AboutCard profile={profile} isOwnProfile={isOwnProfile}/>
                <SkillsCard profile={profile} isOwnProfile={isOwnProfile}/>
                <ContactCard profile={profile} isOwnProfile={isOwnProfile}/>
                <ResumeCard profile={profile} isOwnProfile={isOwnProfile}/>
                <WorkSamplesSlider workSamples={workSamples} isOwnProfile={isOwnProfile}/>
                <Reviews profileId={profile.id}/>
            </div>
        </main>
    );
};

export default CurrentProfileUser;
