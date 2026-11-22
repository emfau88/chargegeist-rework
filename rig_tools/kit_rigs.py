"""Rig landmarks for the kit ghosts, in native sheet pixels of each body crop
(rig_parts/kits/<id>/body.png, which carries a 6 px pad).

  cx, eye_y, eye_dx   face centre line, eye height, half eye distance
  mouth_y             mouth centre
  blush               (dx, y)
  fs                  scale of face parts relative to the body
  arm_l, arm_r        shoulder points on the body
  arm_s               arm scale
  tuft                (x, y) where the tuft stands, plain ghosts only
  eyes                which eyes are drawn ("LR", or "L" when an eye patch is baked in)
  wardrobe            can wear items
"""

PLAIN = dict(cx=125, eye_y=158, eye_dx=40, mouth_y=196, blush=(70, 186), fs=0.72,
             arm_l=(30, 200), arm_r=(222, 200), arm_s=0.95, tuft=(125, 26), eyes="LR", wardrobe=True)

RIGS = {
    "ember": dict(PLAIN),
    "luna": dict(PLAIN),
    "sprout": dict(PLAIN),
    "mochi": dict(PLAIN),
    "sunny": dict(PLAIN),
    "pumpkin": dict(cx=150, eye_y=168, eye_dx=40, mouth_y=208, blush=(72, 196), fs=0.7,
                    arm_l=(40, 225), arm_r=(262, 225), arm_s=0.9, eyes="LR"),
    "samurai": dict(cx=160, eye_y=146, eye_dx=34, mouth_y=176, blush=(60, 168), fs=0.58,
                    arm_l=(62, 248), arm_r=(262, 248), arm_s=0.85, eyes="LR"),
    "witch": dict(cx=155, eye_y=150, eye_dx=33, mouth_y=176, blush=(58, 168), fs=0.58,
                  arm_l=(60, 252), arm_r=(250, 252), arm_s=0.85, eyes="LR"),
    "owl": dict(cx=160, eye_y=63, eye_dx=40, mouth_y=118, blush=(62, 112), fs=0.6,
                arm_l=(40, 210), arm_r=(282, 210), arm_s=0.9, eyes="LR"),
    "kitsune": dict(cx=165, eye_y=150, eye_dx=40, mouth_y=178, blush=(66, 170), fs=0.6,
                    arm_l=(52, 250), arm_r=(250, 250), arm_s=0.85, eyes="LR"),
    "reaper": dict(cx=155, eye_y=140, eye_dx=36, mouth_y=176, blush=(62, 168), fs=0.62,
                   arm_l=(55, 255), arm_r=(250, 255), arm_s=0.85, eyes="LR"),
    "pirate": dict(cx=172, eye_y=170, eye_dx=36, mouth_y=203, blush=(60, 195), fs=0.6,
                   arm_l=(48, 250), arm_r=(262, 250), arm_s=0.85, eyes="L"),
    "aviator": dict(cx=160, eye_y=145, eye_dx=34, mouth_y=178, blush=(60, 170), fs=0.6,
                    arm_l=(52, 255), arm_r=(262, 255), arm_s=0.85, eyes="LR"),
    "starmage": dict(cx=167, eye_y=160, eye_dx=31, mouth_y=190, blush=(58, 183), fs=0.6,
                     arm_l=(52, 262), arm_r=(250, 262), arm_s=0.85, eyes="LR"),
    "forest": dict(cx=157, eye_y=135, eye_dx=32, mouth_y=166, blush=(56, 160), fs=0.58,
                   arm_l=(55, 255), arm_r=(262, 255), arm_s=0.85, eyes="LR"),
}


# Second-generation ghosts (rig_input/neu). Their body is the finished figure of the sheet, so the
# landmarks are where the artist painted the face. In native pixels of rig_parts/kits/<id>/body.png.
#   up        how much the parts are enlarged for the app
#   height    how tall the figure stands on the stage, in stage units (the first generation: about 345)
#   mouth     (x, y) of the smile; these figures look a little to the side, so it is off the centre line
#   fs, ms    scale of eyes and mouth on the body, measured against the painted face
#   arm_l, arm_r, arm_s   shoulder points and arm scale; left out where the figure holds its arms up
#             already or the kit has none
#   limbs     parts that are painted into the figure and bend at a joint instead of being loose pictures:
#             L and R stand for the arms (cactus arms, wings, fins, ears), top for what a tuft would be.
#             at: the joint. shape: the outline of the part, what lies inside turns with it. ramp: how far
#             from the joint the turn begins and where it is complete. gain: degrees of turn per degree of
#             the arm (or tuft) it stands for; negative turns it the other way. max: the most it turns
#             either way. lift: a smaller limit for turning upwards, where a part would run into what is
#             painted above it. All in figure pixels.
# The blush is painted on the figure and is not drawn again.
def limb(at, shape, ramp, gain=0.3, most=24, lift=None):
    return dict(at=at, shape=shape, ramp=ramp, gain=gain, max=most, **({} if lift is None else dict(lift=lift)))


# An outline is drawn with room to spare where the part borders on nothing (there it may lie outside the
# picture), and close where it borders on the rest of the figure.
NEW = {
    # Phoenix and moon deer have a picture of their own (build_new.py, SHEETS): the figure without face, and the
    # wings or ears as loose parts that are set on it. They lie in front of the figure and turn like the cut-out
    # arms below. blush: half the distance between the cheeks and their height; the cheeks are parts of the face.
    "phoenix": dict(up=1.0, height=395, cx=409.5, eye_y=391, eye_dx=72.3, mouth=(409.5, 427), fs=1.0, ms=0.83, blush=(101, 435), arms=dict(
        L=dict(at=(231, 528), gain=0.3, up=22, down=14),
        R=dict(at=(551, 528), gain=0.3, up=22, down=14))),
    "moondeer": dict(up=1.0, height=395, cx=392, eye_y=419, eye_dx=72.2, mouth=(392, 460), fs=0.92, ms=0.76, blush=(99.6, 465), arms=dict(
        L=dict(at=(253, 406), gain=0.35, up=22, down=12),
        R=dict(at=(531, 406), gain=0.35, up=22, down=12))),
    "cloud": dict(up=1.3, height=385, cx=260.5, eye_y=254, eye_dx=55.5, mouth=(266, 285), fs=1.08, ms=0.83,
                  arm_l=(58, 415), arm_r=(392, 415), arm_s=1.0),
    # the cactus arms it holds up
    # Its arms are cut out of the figure (build_new.py, ARMS) and hang where they were painted.
    #   at: the joint. gain: degrees of turn per degree a loose arm would turn. up, down: the most it rises and
    #   sinks from where it was painted. back: it lies behind the figure.
    "cactus": dict(up=1.3, height=385, cx=254, eye_y=260, eye_dx=54, mouth=(260, 290), fs=1.1, ms=0.79, arms=dict(
        L=dict(at=(122, 318), gain=0.4, up=42, down=12),
        R=dict(at=(383, 350), gain=0.16, up=16, down=0, back=True))),
    # The wings are cut out of the figure (see the cactus): they lie behind head, bow and paws, which stay.
    "dragon": dict(up=1.0, height=385, cx=228.5, eye_y=197, eye_dx=65, mouth=(218.5, 236), fs=0.58, ms=0.58, arms=dict(
        L=dict(at=(112, 300), gain=0.3, up=16, down=6, back=True),
        R=dict(at=(380, 305), gain=0.3, up=16, down=6, back=True))),
    # The fins are cut out and wave in front of the bell. The lantern on its stalk is the tuft: it sways behind the
    # rim of the bell and glows with the charge. light: where its glow sits. max: the most it sways either way.
    "jellyfish": dict(up=1.0, height=385, cx=266.5, eye_y=323, eye_dx=78.5, mouth=(267, 364), fs=0.74, ms=0.70, arms=dict(
        L=dict(at=(104, 322), gain=0.4, up=26, down=14),
        R=dict(at=(425, 322), gain=0.4, up=26, down=14),
        top=dict(at=(266, 150), gain=0.6, max=9, light=(470, 165)))),
}


# Wardrobe items worn by the plain ghosts. Placement on the plain body (native px):
#   slot, anchor (fraction of the item image), at (body point), scale, rotation (deg)
# Slots, back to front: halo, back, tail | body | neck | face | brow, eyes, mouth | head | hand | arms
ITEMS = {
    "pumpkin_hat":     dict(slot="head",  anchor=(0.5, 0.78), at=(127, 92), s=1.32),
    "samurai_helmet":  dict(slot="head",  anchor=(0.5, 0.80), at=(127, 96), s=1.45),
    "witch_hat":       dict(slot="head",  anchor=(0.5, 0.80), at=(130, 84), s=1.30),
    "owl_ears":        dict(slot="head",  anchor=(0.5, 0.70), at=(127, 40), s=1.30),
    "kitsune_mask":    dict(slot="head",  anchor=(0.5, 0.72), at=(127, 72), s=1.22),
    "reaper_hood":     dict(slot="head",  anchor=(0.5, 0.62), at=(127, 140), s=1.55),
    "pirate_hat":      dict(slot="head",  anchor=(0.5, 0.80), at=(129, 74), s=1.32),
    "aviator_cap":     dict(slot="head",  anchor=(0.5, 0.80), at=(127, 92), s=1.30),
    "star_hood":       dict(slot="head",  anchor=(0.45, 0.62), at=(129, 70), s=1.40),
    "forest_antlers":  dict(slot="head",  anchor=(0.5, 0.85), at=(127, 40), s=1.15),
    "star_halo":       dict(slot="halo",  anchor=(0.5, 0.80), at=(127, 70), s=1.40),
    "owl_goggles":     dict(slot="brow",  anchor=(0.5, 0.50), at=(125, 104), s=1.10),
    "pirate_bandana":  dict(slot="brow",  anchor=(0.5, 0.40), at=(130, 70), s=1.12),
    "pirate_eyepatch": dict(slot="eyes",  anchor=(0.30, 0.55), at=(165, 158), s=0.85, hide=["eye_R"]),
    "owl_beak":        dict(slot="mouth", anchor=(0.5, 0.40), at=(125, 180), s=0.70),
    "samurai_sash":    dict(slot="neck",  anchor=(0.45, 0.45), at=(127, 228), s=1.30),
    "witch_collar":    dict(slot="neck",  anchor=(0.5, 0.40), at=(127, 230), s=1.10),
    "kitsune_collar":  dict(slot="neck",  anchor=(0.5, 0.30), at=(127, 226), s=1.15),
    "reaper_cloak":    dict(slot="neck",  anchor=(0.5, 0.25), at=(127, 228), s=1.35),
    "aviator_scarf":   dict(slot="neck",  anchor=(0.42, 0.45), at=(130, 228), s=1.15),
    "star_collar":     dict(slot="neck",  anchor=(0.5, 0.35), at=(127, 228), s=1.15),
    "forest_collar":   dict(slot="neck",  anchor=(0.5, 0.22), at=(127, 226), s=1.05),
    "kitsune_tail":    dict(slot="tail",  anchor=(0.12, 0.75), at=(220, 280), s=1.10, rot=-15),
    "reaper_scythe":   dict(slot="back",  anchor=(0.62, 0.95), at=(18, 240), s=1.30, rot=-10),
    "aviator_lantern": dict(slot="hand",  anchor=(0.5, 0.06), at=(250, 238), s=0.95),
}
SLOT_ORDER = ["halo", "back", "tail", "body", "neck", "face", "brow", "eyes", "mouth", "head", "hand", "arms"]
