using SpacefarerService as service from '../../srv/spacefarer-service';
annotate service.Spacefarers with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'Spacefarer Name',
                Value : name,
            },
            {
                $Type : 'UI.DataField',
                Label : 'E-mail',
                Value : email,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'Personal Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Navigation & Training',
            ID : 'NavigationTraining',
            Target : '@UI.FieldGroup#NavigationTraining',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Equipment & Resources',
            ID : 'EquipmentResources',
            Target : '@UI.FieldGroup#EquipmentResources',
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
    UI.HeaderInfo : {
        Title : {
            $Type : 'UI.DataField',
            Value : name,
        },
        TypeName : '',
        TypeNamePlural : '',
    },
    UI.FieldGroup #NavigationTraining : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : navigationSkill,
            },
            {
                $Type : 'UI.DataField',
                Value : trialTimeMinutes,
                Label : 'Trial Result (minutes)',
            },
        ],
    },
    UI.FieldGroup #EquipmentResources : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : stardust,
                Label : 'Stardust',
            },
            {
                $Type : 'UI.DataField',
                Value : suitColor,
            },
        ],
    },
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
    suitColor @(
        Common.Label : 'Suit Color',
        Common.Text : suitColorText,
        Common.TextArrangement : #TextOnly,
        Common.ValueListWithFixedValues : true,
        Common.ValueList : {
            $Type : 'Common.ValueListType',
            Label : 'Suit Color',
            CollectionPath : 'SuitColors',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : suitColor,
                    ValueListProperty : 'code',
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name',
                },
            ],
        }
    )
};

annotate service.SuitColors with {
    code @(
        Common.Text : name,
        Common.TextArrangement : #TextOnly
    )
};

annotate service.Spacefarers with {
  name             @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 3] } };
  email            @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 3] } };
  navigationSkill  @Common.FieldControl: #ReadOnly;
  trialTimeMinutes @Common.FieldControl: #ReadOnly;
  originPlanet     @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 3] } };
  department       @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 3] } };
  position         @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 3] } };
};
