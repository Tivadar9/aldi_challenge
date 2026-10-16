using SpacefarerService as service from '../../srv/spacefarer-service';
annotate service.Spacefarers with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'name',
                Value : name,
            },
            {
                $Type : 'UI.DataField',
                Label : 'email',
                Value : email,
            },
            {
                $Type : 'UI.DataField',
                Label : 'stardust',
                Value : stardust,
            },
            {
                $Type : 'UI.DataField',
                Label : 'navigationSkill',
                Value : navigationSkill,
            },
            {
                $Type : 'UI.DataField',
                Label : 'trialTimeMinutes',
                Value : trialTimeMinutes,
            },
            {
                $Type : 'UI.DataField',
                Label : 'suitColor',
                Value : suitColor,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'Spacefarer',
            Value : name,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Stardust',
            Value : stardust,
        },
        {
            $Type : 'UI.DataField',
            Value : suitColor,
            Label : 'Suit Color',
        },
    ],
    UI.SelectionFields : [
        suitColor,
    ],
);

annotate service.Spacefarers with {
    originPlanet @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Planets',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : originPlanet_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'description',
            },
        ],
    }
};

annotate service.Spacefarers with {
    department @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Departments',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : department_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'description',
            },
        ],
    }
};

annotate service.Spacefarers with {
    position @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Positions',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : position_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'description',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'salary',
            },
        ],
    }
};

annotate service.Spacefarers with {
    name @Common.Label : 'SpaceFarer'
};

annotate service.Planets with {
    name @(
        Common.Label : 'Origin Planet',
        )
};

annotate service.Spacefarers with {
    navigationSkill @Common.Label : 'Navigation Skill'
};

annotate service.Spacefarers with {
    suitColor @Common.Label : 'Suit Color'
};

